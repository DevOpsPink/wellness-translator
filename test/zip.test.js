import assert from 'node:assert/strict';
import { deflateRawSync } from 'node:zlib';
import { describe, it } from 'node:test';

import { findInZip, openHealthExport } from '../src/lib/zip.js';

const STORED = 0;
const DEFLATED = 8;

/**
 * Build a real archive, byte by byte.
 *
 * Writing the format out by hand is the point: a fixture produced by the
 * same assumptions as the reader would agree with it about anything,
 * including a mistake.
 */
function buildZip(entries) {
  const encoder = new TextEncoder();
  const parts = [];
  const directory = [];
  let offset = 0;

  for (const { name, contents, method } of entries) {
    const nameBytes = encoder.encode(name);
    const raw = encoder.encode(contents);
    const stored = method === DEFLATED ? deflateRawSync(raw) : raw;

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header
    local.setUint16(4, 20, true); // version needed
    local.setUint16(8, method, true);
    local.setUint32(14, 0, true); // crc32, which this reader never checks
    local.setUint32(18, stored.length, true);
    local.setUint32(22, raw.length, true);
    local.setUint16(26, nameBytes.length, true);

    parts.push(new Uint8Array(local.buffer), nameBytes, stored);

    const central = new DataView(new ArrayBuffer(46));
    central.setUint32(0, 0x02014b50, true); // central file header
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(10, method, true);
    central.setUint32(20, stored.length, true);
    central.setUint32(24, raw.length, true);
    central.setUint16(28, nameBytes.length, true);
    central.setUint32(42, offset, true); // where the local header sits
    directory.push(new Uint8Array(central.buffer), nameBytes);

    offset += 30 + nameBytes.length + stored.length;
  }

  const directorySize = directory.reduce((sum, part) => sum + part.length, 0);

  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, entries.length, true);
  end.setUint16(10, entries.length, true);
  end.setUint32(12, directorySize, true);
  end.setUint32(16, offset, true);

  return new Blob([...parts, ...directory, new Uint8Array(end.buffer)]);
}

const readAll = async (source) => {
  const chunks = [];
  for await (const chunk of source.stream()) chunks.push(chunk);
  return new TextDecoder().decode(await new Blob(chunks).arrayBuffer());
};

describe('findInZip', () => {
  it('finds a file by the end of its name', async () => {
    const zip = buildZip([
      { name: 'apple_health_export/export_cda.xml', contents: 'wrong one', method: STORED },
      { name: 'apple_health_export/export.xml', contents: '<HealthData/>', method: STORED },
    ]);

    const entry = await findInZip(zip, 'export.xml');
    assert.equal(entry.name, 'apple_health_export/export.xml');
  });

  it('reads the sizes and method from the archive', async () => {
    const contents = '<HealthData>'.repeat(500);
    const zip = buildZip([
      { name: 'apple_health_export/export.xml', contents, method: DEFLATED },
    ]);

    const entry = await findInZip(zip, 'export.xml');
    assert.equal(entry.method, DEFLATED);
    assert.equal(entry.uncompressedSize, contents.length);
    assert.ok(entry.bytes.size < contents.length, 'the slice is the compressed one');
  });

  it('returns nothing for a name the archive does not hold', async () => {
    const zip = buildZip([{ name: 'workout-routes/a.gpx', contents: 'x', method: STORED }]);
    assert.equal(await findInZip(zip, 'export.xml'), null);
  });

  it('refuses something that is not an archive', async () => {
    await assert.rejects(() => findInZip(new Blob(['hello, not a zip']), 'export.xml'), {
      message: /does not look like a zip/,
    });
  });
});

describe('openHealthExport', () => {
  it('inflates the entry back to what went in', async () => {
    const contents = `<HealthData>${'<Record/>'.repeat(2000)}</HealthData>`;
    const zip = buildZip([
      { name: 'apple_health_export/export.xml', contents, method: DEFLATED },
    ]);

    const opened = await openHealthExport(zip);
    assert.equal(await readAll(opened), contents);
  });

  it('handles an entry that was never compressed', async () => {
    const contents = '<HealthData/>';
    const zip = buildZip([
      { name: 'apple_health_export/export.xml', contents, method: STORED },
    ]);

    assert.equal(await readAll(await openHealthExport(zip)), contents);
  });

  it('reports the size the stream will produce, not the size on disk', async () => {
    // Progress counts decompressed bytes. Handed the compressed figure, the
    // bar ran to 2,700% on a real export.
    const contents = 'x'.repeat(20_000);
    const zip = buildZip([
      { name: 'apple_health_export/export.xml', contents, method: DEFLATED },
    ]);

    const opened = await openHealthExport(zip);
    assert.equal(opened.size, contents.length);
  });

  it('says plainly when there is no export inside', async () => {
    const zip = buildZip([{ name: 'workout-routes/a.gpx', contents: 'x', method: STORED }]);
    await assert.rejects(() => openHealthExport(zip), { message: /No export\.xml/ });
  });
});
