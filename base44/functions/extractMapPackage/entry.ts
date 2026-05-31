/**
 * extractMapPackage — extracts and converts the Shattered Crown production
 * map package, and outputs ready-to-use TypeScript map definition source.
 */
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function inflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  writer.write(data);
  writer.close();
  const reader = ds.readable.getReader();
  const chunks = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

async function extractZipFiles(zipUrl) {
  const zipResp = await fetch(zipUrl);
  const zipBytes = new Uint8Array(await zipResp.arrayBuffer());
  const decoder = new TextDecoder();
  const files = {};
  let offset = 0;
  while (offset < zipBytes.length - 4) {
    if (zipBytes[offset] === 0x50 && zipBytes[offset+1] === 0x4b &&
        zipBytes[offset+2] === 0x03 && zipBytes[offset+3] === 0x04) {
      const compressionMethod = zipBytes[offset+8] | (zipBytes[offset+9] << 8);
      const compressedSize = zipBytes[offset+18] | (zipBytes[offset+19] << 8) | (zipBytes[offset+20] << 16) | (zipBytes[offset+21] << 24);
      const uncompressedSize = zipBytes[offset+22] | (zipBytes[offset+23] << 8) | (zipBytes[offset+24] << 16) | (zipBytes[offset+25] << 24);
      const fileNameLength = zipBytes[offset+26] | (zipBytes[offset+27] << 8);
      const extraFieldLength = zipBytes[offset+28] | (zipBytes[offset+29] << 8);
      const fileN = decoder.decode(zipBytes.slice(offset+30, offset+30+fileNameLength));
      const dataOffset = offset + 30 + fileNameLength + extraFieldLength;
      const compressedData = zipBytes.slice(dataOffset, dataOffset + compressedSize);
      if (fileN.endsWith('.json')) {
        let content;
        if (compressionMethod === 0) content = decoder.decode(compressedData);
        else if (compressionMethod === 8) content = decoder.decode(await inflateRaw(compressedData));
        if (content) files[fileN] = JSON.parse(content);
      }
      offset = dataOffset + compressedSize;
    } else { offset++; }
  }
  return files;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user || user.role !== 'admin') return Response.json({ error: 'Admin only' }, { status: 403 });

  const body = await req.json();
  const { action } = body;
  const ZIP_URL = 'https://media.base44.com/files/public/6a1504188a2a3ce4c5d33e1b/7b8356ef3_Shattered_Crown_Final_Game_Map_Data_Package.zip';

  const files = await extractZipFiles(ZIP_URL);
  const meta = files['shattered_crown_map_metadata_final.json'];
  const anchors = files['shattered_crown_anchors_final.json'];

  // Scale: 10240×10240 → 1000×1400
  const SX = 1000 / 10240;
  const SY = 1400 / 10240;
  const sx = (v) => Math.round(v * SX * 10) / 10;
  const sy = (v) => Math.round(v * SY * 10) / 10;

  if (action === 'get_territories') {
    const { offset = 0, limit = 15 } = body;
    const territories = meta.territories.slice(offset, offset + limit).map(t => {
      const poly = t.polygon ?? [];
      const pts = poly.map(p => `${sx(p.x)},${sy(p.y)}`).join(' ');
      const center = t.center ?? { x: 0, y: 0 };
      const troop  = t.troop_anchor ?? center;
      const label  = t.label_anchor ?? center;
      return {
        territory_id: t.territory_id,
        name: t.name,
        continent_id: t.continent_id,
        region_id: t.region_id,
        terrain: t.terrain,
        points: pts,
        cx: sx(center.x),
        cy: sy(center.y),
        troop_x: sx(troop.x),
        troop_y: sy(troop.y),
        label_x: sx(label.x),
        label_y: sy(label.y),
        resource_distribution: t.resource_distribution ?? { brick: 20, lumber: 20, wool: 20, grain: 20, ore: 20 },
      };
    });
    return Response.json({ territories, total: meta.territories.length, offset, limit });
  }

  if (action === 'get_adjacency_and_anchors') {
    const continentLabelAnchors = {};
    for (const [cid, anch] of Object.entries(anchors.continent_label_anchors ?? {})) {
      continentLabelAnchors[cid] = { x: sx(anch.x), y: sy(anch.y) };
    }
    const wt = anchors.world_title_label_anchor ?? {};
    return Response.json({
      adjacency: meta.adjacency,
      continent_label_anchors: continentLabelAnchors,
      world_title_anchor: { x: sx(wt.x ?? 0), y: sy(wt.y ?? 0) },
    });
  }

  return Response.json({ error: 'action: get_territories | get_adjacency_and_anchors' }, { status: 400 });
});