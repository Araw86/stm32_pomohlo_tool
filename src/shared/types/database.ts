export interface Family {
  id: string;
  name: string;
  url: string;
  subfamilyIds: string[];
}

export interface Subfamily {
  id: string;
  name: string;
  familyId: string;
  url: string;
  productsUrl: string;
  documentationUrl: string;
  deviceIds: string[];
  documentIds: string[];
  scrapedAt?: string;
}

export interface Device {
  id: string;
  subfamilyId: string;
  /** Canonical device product page on st.com. */
  url?: string;
  /** Convention-based per-device datasheet PDF URL. */
  datasheetUrl?: string;
  /** ST document id of the datasheet that applies to this device, e.g.
   * "DS13866". A single DS#### can be shared by multiple devices. */
  datasheetId?: string;
  /** Doc IDs scraped from this device's own documentation tab. */
  documentIds?: string[];
  /** Board IDs (matching `Board.id`) compatible with this device, populated
   * by the boards crawl. Added in databaseStructure 2. */
  boardIds?: string[];
  /** ISO timestamp of the last deep-mode scrape for this device. */
  scrapedAt?: string;
  /** ISO timestamp of the last boards-crawl pass for this device. */
  boardsScrapedAt?: string;
}

/** A single schematic file attached to a board. PDFs can be downloaded
 * locally; ZIPs are only opened in the user's browser. */
export interface BoardSchematic {
  id: string;
  title: string;
  version?: string;
  /** ISO date "YYYY-MM-DD". */
  lastUpdate?: string;
  url: string;
  /** Always upper-cased by the scraper. */
  format: 'PDF' | 'ZIP' | string;
  /** PDF only. */
  pdfBytes?: number;
  /** PDF only — ISO timestamp from the PDF /CreationDate metadata. */
  pdfCreated?: string;
}

/** ST evaluation board (Nucleo / Discovery / etc.) compatible with one or
 * more devices. Added in databaseStructure 2. */
export interface Board {
  id: string;
  name: string;
  /** "Nucleo", "Discovery", "Other", … kept open for new types. */
  type: string;
  /** Canonical product page on st.com. */
  url: string;
  /** Devices the scraper says this board supports. */
  deviceIds: string[];
  schematics: BoardSchematic[];
  scrapedAt?: string;
}

/** Per-version snapshot of a document. The current live version is always
 * the LAST entry in `DocumentEntry.versions` (oldest first). */
export interface DocumentVersion {
  /** Version label as published, e.g. "70.0", "1", "2.3". */
  version: string;
  /** "Last update" date, ISO "YYYY-MM-DD". Optional for legacy history. */
  lastUpdate?: string;
  /** ISO timestamp of the PDF's /CreationDate metadata. Used to detect
   * whether the local copy is older than the published PDF. */
  pdfCreated?: string;
  /** ISO timestamp of the PDF's /ModDate metadata. */
  pdfModified?: string;
  /** Size of the published PDF in bytes. */
  pdfBytes?: number;
}

export interface DocumentEntry {
  id: string;
  subfamilyIds: string[];
  type: string;
  title: string;
  url: string;
  /** Every observed version, oldest first. The live one is the last entry. */
  versions: DocumentVersion[];
}

export interface DatabaseMeta {
  /** Monotonic content-revision counter from the upstream scraper. */
  databaseVersion: number;
  /** ISO timestamp at which `databaseVersion` was last bumped. */
  databaseVersionCreatedAt: string;
  /** Schema-version of the JSON files. Bumped when fields/tables are
   * added or renamed. The app refuses to load a structure newer than
   * SUPPORTED_DATABASE_STRUCTURE in loadDatabase.ts. Absent on v1 dumps. */
  databaseStructure?: number;
  /** ISO timestamp at which `databaseStructure` was last bumped. */
  databaseStructureCreatedAt?: string;
  /** ISO timestamp of the last full scrape. */
  scrapedAt: string;
  /** Identifier of the source the loaded data came from (e.g. 'main'). */
  sourceId: string;
  /** Display name of the source. */
  sourceName: string;
  /** GitHub release tag the local copy was downloaded from (e.g. "v7"). */
  releaseTag?: string;
  /** GitHub release display name. */
  releaseName?: string;
  /** ISO timestamp the release was published on GitHub. */
  releasePublishedAt?: string;
  /** ISO timestamp the local copy was downloaded from that release. */
  downloadedAt?: string;
}

export interface DatabasePayload {
  families: Family[];
  subfamilies: Subfamily[];
  documents: DocumentEntry[];
  devices: Device[];
  /** Empty array for v1 databases (boards.json absent). */
  boards: Board[];
  meta: DatabaseMeta;
}

/** Returns the live (newest) version of a document, or undefined when the
 * versions array is empty (shouldn't happen with current scraper output). */
export function liveVersion(doc: DocumentEntry): DocumentVersion | undefined {
  return doc.versions.length > 0 ? doc.versions[doc.versions.length - 1] : undefined;
}
