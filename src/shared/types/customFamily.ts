import type {
  Device,
  DocumentEntry,
  Family,
  Subfamily,
} from './database';

/** Self-contained on-disk representation of a single custom family.
 *
 * One file per family at `<userData>/local_databases/<familyId>/family.json`,
 * holding the same record types as the main database so the existing UI can
 * later display them without conversion.
 *
 * Custom families are not part of the scraped main database — they are
 * user-curated for documents (datasheets, app notes, etc.) the user wants
 * to manage outside the upstream catalog.
 */
export interface CustomFamilyPayload {
  family: Family;
  subfamilies: Subfamily[];
  devices: Device[];
  documents: DocumentEntry[];
  createdAt: string;
  updatedAt: string;
}

/** Lightweight summary returned by the "list" IPC, without the full tree. */
export interface CustomFamilySummary {
  id: string;
  name: string;
  subfamilyCount: number;
  deviceCount: number;
  documentCount: number;
  updatedAt: string;
}
