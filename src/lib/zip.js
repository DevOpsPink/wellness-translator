/**
 * Enough of the ZIP format to reach one file inside export.zip.
 *
 * Health hands you a zip. Asking someone to unzip it first and then hunt for
 * export.xml among the workout routes and electrocardiograms is a step people
 * abandon the app at, and the browser can already inflate a deflate stream —
 * all that is missing is knowing where in the archive to start reading.
 *
 * A zip is read from the back. The end-of-central-directory record points at
 * a table of every file in the archive, and each row of that table points at
 * a local header, after which the compressed bytes begin. Nothing here needs
 * the whole archive in memory: the entry is a slice of the file, and the
 * slice is streamed.
 *
 * Deliberately partial. No ZIP64, no encryption, no multi-part archives —
 * Apple's export needs none of them, and pretending otherwise would be more
 * code claiming to work than code that does.
 */

const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const CENTRAL_FILE_HEADER = 0x02014b50;

/** The record is at the very end, unless there is a comment after it. */
const MAX_COMMENT = 0xffff;
const EOCD_LENGTH = 22;

const STORED = 0;
const DEFLATED = 8;

async function readSlice(file, start, end) {
  return new DataView(await file.slice(start, end).arrayBuffer());
}

/** Walk backwards until the end-of-central-directory signature turns up. */
function findEndRecord(view) {
  for (let at = view.byteLength - EOCD_LENGTH; at >= 0; at -= 1) {
    if (view.getUint32(at, true) === END_OF_CENTRAL_DIRECTORY) return at;
  }
  return -1;
}

/**
 * Locate one file in the archive by the end of its name.
 *
 * @returns the entry's compressed bytes as a Blob, plus what is needed to
 *   make sense of them, or null if the archive holds no such name.
 */
export async function findInZip(file, nameEndsWith) {
  const tailLength = Math.min(file.size, MAX_COMMENT + EOCD_LENGTH);
  const tail = await readSlice(file, file.size - tailLength, file.size);

  const end = findEndRecord(tail);
  if (end === -1) throw new Error('That does not look like a zip archive.');

  const entries = tail.getUint16(end + 10, true);
  const directorySize = tail.getUint32(end + 12, true);
  const directoryAt = tail.getUint32(end + 16, true);

  const directory = await readSlice(
    file,
    directoryAt,
    directoryAt + directorySize,
  );

  const decoder = new TextDecoder();
  let at = 0;

  for (let index = 0; index < entries; index += 1) {
    if (directory.getUint32(at, true) !== CENTRAL_FILE_HEADER) break;

    const method = directory.getUint16(at + 10, true);
    const compressedSize = directory.getUint32(at + 20, true);
    const uncompressedSize = directory.getUint32(at + 24, true);
    const nameLength = directory.getUint16(at + 28, true);
    const extraLength = directory.getUint16(at + 30, true);
    const commentLength = directory.getUint16(at + 32, true);
    const localHeaderAt = directory.getUint32(at + 42, true);

    const name = decoder.decode(
      new Uint8Array(directory.buffer, at + 46, nameLength),
    );

    if (name.endsWith(nameEndsWith)) {
      // The local header repeats the name and extra field, and its own copies
      // may be different lengths from the ones in the directory — so where the
      // data starts can only be worked out from the local header itself.
      const local = await readSlice(file, localHeaderAt, localHeaderAt + 30);
      const dataAt =
        localHeaderAt +
        30 +
        local.getUint16(26, true) +
        local.getUint16(28, true);

      return {
        name,
        method,
        uncompressedSize,
        bytes: file.slice(dataAt, dataAt + compressedSize),
      };
    }

    at += 46 + nameLength + extraLength + commentLength;
  }

  return null;
}

/**
 * Present `export.xml` inside a zip as something the importer can read.
 *
 * The importer only ever asks for `.size` and `.stream()`. The size given is
 * the *uncompressed* one, taken from the archive's own table — it is what the
 * stream will actually produce, and what the progress figure has to count
 * against.
 */
export async function openHealthExport(file) {
  const entry = await findInZip(file, 'export.xml');
  if (entry === null) {
    throw new Error('No export.xml inside that zip.');
  }

  if (entry.method !== STORED && entry.method !== DEFLATED) {
    throw new Error(`That zip uses a compression this reader does not know.`);
  }

  if (entry.method === DEFLATED && typeof DecompressionStream !== 'function') {
    throw new Error('This browser cannot unzip. Unzip it and pick the XML.');
  }

  return {
    size: entry.uncompressedSize,
    stream: () =>
      entry.method === STORED
        ? entry.bytes.stream()
        : entry.bytes
            .stream()
            .pipeThrough(new DecompressionStream('deflate-raw')),
  };
}
