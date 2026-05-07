import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import AdmZip from 'adm-zip';

import type {
  CustomFamilyPayload,
  CustomFamilySummary,
} from '../../shared/types/customFamily';
import type {
  Device,
  DocumentEntry,
  Family,
  Subfamily,
} from '../../shared/types/database';
import { loadConfig } from './configStore';
import { pdfPath, sidecarPath, writeSidecar } from './sidecar';

/** Folder name used by the bundled scraped database. We must never collide
 * with it when picking custom-family folder names. */
const RESERVED_IDS = ['main'];
const FAMILY_FILE = 'family.json';

function customFamiliesRoot(): string {
  return path.join(app.getPath('userData'), 'local_databases');
}

function customFamilyDir(id: string): string {
  return path.join(customFamiliesRoot(), id);
}

export function isReservedId(id: string): boolean {
  return RESERVED_IDS.includes(id);
}

/** Force input into a safe folder/identifier name: keep alphanumerics,
 * underscore and dash; collapse everything else; trim. */
export function sanitizeFamilyId(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/** Same shape but uppercased — matches existing repo convention (DS13086). */
export function sanitizeDocId(input: string): string {
  return input
    .trim()
    .replace(/\.pdf$/i, '')
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

/** Atomic write with copy-instead-of-rename so Windows never sees the
 * destination file go missing mid-write (same fix used for the main DB). */
function atomicWriteJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf8');
  fs.copyFileSync(tmp, file);
  try {
    fs.rmSync(tmp, { force: true });
  } catch {
    /* leftover .tmp is harmless */
  }
}

export function listCustomFamilies(): CustomFamilySummary[] {
  const root = customFamiliesRoot();
  if (!fs.existsSync(root)) return [];
  const out: CustomFamilySummary[] = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (isReservedId(entry.name)) continue;
    const file = path.join(root, entry.name, FAMILY_FILE);
    if (!fs.existsSync(file)) continue;
    try {
      const payload = JSON.parse(fs.readFileSync(file, 'utf8')) as CustomFamilyPayload;
      out.push({
        id: payload.family.id,
        name: payload.family.name,
        subfamilyCount: payload.subfamilies.length,
        deviceCount: payload.devices.length,
        documentCount: payload.documents.length,
        updatedAt: payload.updatedAt,
      });
    } catch (err) {
      console.warn(`Failed to read ${file}:`, err);
    }
  }
  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function loadCustomFamily(id: string): CustomFamilyPayload | null {
  const file = path.join(customFamilyDir(id), FAMILY_FILE);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as CustomFamilyPayload;
  } catch (err) {
    console.error(`Failed to read ${file}:`, err);
    return null;
  }
}

function saveCustomFamily(payload: CustomFamilyPayload): CustomFamilyPayload {
  payload.updatedAt = new Date().toISOString();
  atomicWriteJson(
    path.join(customFamilyDir(payload.family.id), FAMILY_FILE),
    payload,
  );
  return payload;
}

/** Pick the first id that doesn't already exist on disk. */
function uniqueFamilyId(baseId: string): string {
  let id = baseId;
  let n = 2;
  while (fs.existsSync(customFamilyDir(id))) {
    id = `${baseId}_${n++}`;
  }
  return id;
}

export function createCustomFamily(name: string): CustomFamilyPayload {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Family name is required.');
  const baseId = sanitizeFamilyId(trimmed);
  if (!baseId) {
    throw new Error('Family name contains no usable characters for an id.');
  }
  if (isReservedId(baseId)) {
    throw new Error(`'${baseId}' is reserved. Please choose a different name.`);
  }
  const id = uniqueFamilyId(baseId);
  // User said: usually just one subfamily + one device per custom family,
  // but we don't enforce that — these are simply convenient defaults.
  const subfamilyId = `${id}_subfamily`;
  const deviceId = `${id}_device`;
  const family: Family = {
    id,
    name: trimmed,
    url: '',
    subfamilyIds: [subfamilyId],
  };
  const subfamily: Subfamily = {
    id: subfamilyId,
    name: trimmed,
    familyId: id,
    url: '',
    productsUrl: '',
    documentationUrl: '',
    deviceIds: [deviceId],
    documentIds: [],
  };
  const device: Device = {
    id: deviceId,
    subfamilyId,
    documentIds: [],
  };
  const now = new Date().toISOString();
  return saveCustomFamily({
    family,
    subfamilies: [subfamily],
    devices: [device],
    documents: [],
    createdAt: now,
    updatedAt: now,
  });
}

export function renameCustomFamily(id: string, newName: string): CustomFamilyPayload {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Family name is required.');
  const payload = loadCustomFamily(id);
  if (!payload) throw new Error(`Family '${id}' not found.`);
  payload.family.name = trimmed;
  return saveCustomFamily(payload);
}

/** Remove the family folder. Optionally also remove every PDF this family
 * referenced from the local repository. */
export function deleteCustomFamily(
  id: string,
  options: { deletePdfs: boolean },
): { removedPdfs: string[]; missingPdfs: string[] } {
  if (isReservedId(id)) {
    throw new Error(`Cannot delete reserved family '${id}'.`);
  }
  const payload = loadCustomFamily(id);
  const removedPdfs: string[] = [];
  const missingPdfs: string[] = [];
  if (payload && options.deletePdfs) {
    const { repoPath } = loadConfig();
    if (repoPath) {
      for (const doc of payload.documents) {
        const pdf = pdfPath(repoPath, doc.id);
        const sidecar = sidecarPath(repoPath, doc.id);
        try {
          if (fs.existsSync(pdf)) {
            fs.rmSync(pdf, { force: true });
            removedPdfs.push(doc.id);
          } else {
            missingPdfs.push(doc.id);
          }
          if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
        } catch (err) {
          console.warn(`Failed to remove PDF for ${doc.id}:`, err);
        }
      }
    }
  }
  const dir = customFamilyDir(id);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  return { removedPdfs, missingPdfs };
}

/* -------------------------------------------------------------------------
 * Subfamily / device operations on an already-loaded family
 * ---------------------------------------------------------------------- */

export function addSubfamily(
  familyId: string,
  subfamilyName: string,
): CustomFamilyPayload {
  const trimmed = subfamilyName.trim();
  if (!trimmed) throw new Error('Subfamily name is required.');
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const baseId = sanitizeFamilyId(trimmed);
  let subId = baseId;
  let n = 2;
  while (payload.subfamilies.some((s) => s.id === subId)) {
    subId = `${baseId}_${n++}`;
  }
  payload.subfamilies.push({
    id: subId,
    name: trimmed,
    familyId,
    url: '',
    productsUrl: '',
    documentationUrl: '',
    deviceIds: [],
    documentIds: [],
  });
  payload.family.subfamilyIds.push(subId);
  return saveCustomFamily(payload);
}

export function renameSubfamily(
  familyId: string,
  subfamilyId: string,
  newName: string,
): CustomFamilyPayload {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Subfamily name is required.');
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const sub = payload.subfamilies.find((s) => s.id === subfamilyId);
  if (!sub) throw new Error(`Subfamily '${subfamilyId}' not found.`);
  sub.name = trimmed;
  return saveCustomFamily(payload);
}

export function deleteSubfamily(
  familyId: string,
  subfamilyId: string,
  options: { deletePdfs: boolean },
): { removedPdfs: string[] } {
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const sub = payload.subfamilies.find((s) => s.id === subfamilyId);
  if (!sub) throw new Error(`Subfamily '${subfamilyId}' not found.`);

  // Devices belonging to this subfamily go away.
  const deviceIds = new Set(
    payload.devices.filter((d) => d.subfamilyId === subfamilyId).map((d) => d.id),
  );
  payload.devices = payload.devices.filter((d) => d.subfamilyId !== subfamilyId);

  // Documents that referenced ONLY this subfamily are removed; documents
  // shared with other subfamilies just lose this one from their list.
  const removedDocIds: string[] = [];
  payload.documents = payload.documents.filter((doc) => {
    doc.subfamilyIds = doc.subfamilyIds.filter((id) => id !== subfamilyId);
    if (doc.subfamilyIds.length === 0) {
      removedDocIds.push(doc.id);
      return false;
    }
    return true;
  });

  // Strip dangling references in remaining devices / subfamilies.
  for (const otherSub of payload.subfamilies) {
    otherSub.documentIds = (otherSub.documentIds ?? []).filter(
      (id) => !removedDocIds.includes(id),
    );
  }
  for (const dev of payload.devices) {
    if (dev.documentIds) {
      dev.documentIds = dev.documentIds.filter((id) => !removedDocIds.includes(id));
    }
    if (dev.datasheetId && removedDocIds.includes(dev.datasheetId)) {
      delete dev.datasheetId;
    }
  }

  payload.subfamilies = payload.subfamilies.filter((s) => s.id !== subfamilyId);
  payload.family.subfamilyIds = payload.family.subfamilyIds.filter(
    (id) => id !== subfamilyId,
  );

  // Remove PDFs for documents we just dropped, if requested.
  const removedPdfs: string[] = [];
  if (options.deletePdfs && removedDocIds.length > 0) {
    const { repoPath } = loadConfig();
    if (repoPath) {
      for (const docId of removedDocIds) {
        const pdf = pdfPath(repoPath, docId);
        const sidecar = sidecarPath(repoPath, docId);
        try {
          if (fs.existsSync(pdf)) {
            fs.rmSync(pdf, { force: true });
            removedPdfs.push(docId);
          }
          if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
        } catch (err) {
          console.warn(`Failed to remove PDF for ${docId}:`, err);
        }
      }
    }
  }
  // Remove deviceId references just for clarity (devices array already filtered).
  void deviceIds;

  saveCustomFamily(payload);
  return { removedPdfs };
}

export function addDevice(
  familyId: string,
  subfamilyId: string,
  deviceName: string,
): CustomFamilyPayload {
  const trimmed = deviceName.trim();
  if (!trimmed) throw new Error('Device name is required.');
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const sub = payload.subfamilies.find((s) => s.id === subfamilyId);
  if (!sub) throw new Error(`Subfamily '${subfamilyId}' not found.`);
  const baseId = sanitizeFamilyId(trimmed);
  let devId = baseId;
  let n = 2;
  while (payload.devices.some((d) => d.id === devId)) {
    devId = `${baseId}_${n++}`;
  }
  payload.devices.push({
    id: devId,
    subfamilyId,
    documentIds: [],
  });
  sub.deviceIds.push(devId);
  return saveCustomFamily(payload);
}

export function renameDevice(
  familyId: string,
  deviceId: string,
  newName: string,
): CustomFamilyPayload {
  // Devices in the schema don't have a `name` field — the id IS the name
  // (e.g. STM32F405RG). To rename we'd have to mint a new id and rewrite
  // every reference. Cheaper for now: treat rename as id-rename.
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Device name is required.');
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const newId = sanitizeFamilyId(trimmed);
  if (!newId) throw new Error('Device name is empty after sanitization.');
  if (payload.devices.some((d) => d.id === newId && d.id !== deviceId)) {
    throw new Error(`Another device already uses the id '${newId}'.`);
  }
  const dev = payload.devices.find((d) => d.id === deviceId);
  if (!dev) throw new Error(`Device '${deviceId}' not found.`);
  if (dev.id === newId) return payload;
  const oldId = dev.id;
  dev.id = newId;
  for (const sub of payload.subfamilies) {
    sub.deviceIds = sub.deviceIds.map((id) => (id === oldId ? newId : id));
  }
  return saveCustomFamily(payload);
}

export function deleteDevice(
  familyId: string,
  deviceId: string,
  options: { deletePdfs: boolean },
): { removedPdfs: string[] } {
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const dev = payload.devices.find((d) => d.id === deviceId);
  if (!dev) throw new Error(`Device '${deviceId}' not found.`);

  // Documents bound to ONLY this device go away. A document is "bound to a
  // device" when it appears in the device's datasheetId or documentIds and
  // no other device in the same subfamily references it.
  const docIdsOnDevice = new Set<string>();
  if (dev.datasheetId) docIdsOnDevice.add(dev.datasheetId);
  for (const id of dev.documentIds ?? []) docIdsOnDevice.add(id);

  // Find docs only referenced by this device.
  const otherDevices = payload.devices.filter((d) => d.id !== deviceId);
  const sharedDocIds = new Set<string>();
  for (const other of otherDevices) {
    if (other.datasheetId) sharedDocIds.add(other.datasheetId);
    for (const id of other.documentIds ?? []) sharedDocIds.add(id);
  }
  const docIdsToRemove = [...docIdsOnDevice].filter(
    (id) => !sharedDocIds.has(id),
  );

  // Drop the device.
  payload.devices = payload.devices.filter((d) => d.id !== deviceId);
  for (const sub of payload.subfamilies) {
    sub.deviceIds = sub.deviceIds.filter((id) => id !== deviceId);
  }

  // Drop the docs the device exclusively owned.
  if (docIdsToRemove.length > 0) {
    payload.documents = payload.documents.filter(
      (d) => !docIdsToRemove.includes(d.id),
    );
    for (const sub of payload.subfamilies) {
      sub.documentIds = (sub.documentIds ?? []).filter(
        (id) => !docIdsToRemove.includes(id),
      );
    }
  }

  const removedPdfs: string[] = [];
  if (options.deletePdfs && docIdsToRemove.length > 0) {
    const { repoPath } = loadConfig();
    if (repoPath) {
      for (const docId of docIdsToRemove) {
        const pdf = pdfPath(repoPath, docId);
        const sidecar = sidecarPath(repoPath, docId);
        try {
          if (fs.existsSync(pdf)) {
            fs.rmSync(pdf, { force: true });
            removedPdfs.push(docId);
          }
          if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
        } catch (err) {
          console.warn(`Failed to remove PDF for ${docId}:`, err);
        }
      }
    }
  }

  saveCustomFamily(payload);
  return { removedPdfs };
}

/* -------------------------------------------------------------------------
 * Document operations
 * ---------------------------------------------------------------------- */

export interface AddDocumentInput {
  familyId: string;
  subfamilyId: string;
  deviceId: string;
  sourcePath: string;
  docId: string;
  type: string;
  title: string;
  version?: string;
  /** Date in ISO YYYY-MM-DD form. Optional — defaults to today. */
  lastUpdate?: string;
}

export function addDocumentToFamily(
  input: AddDocumentInput,
): CustomFamilyPayload {
  const { repoPath } = loadConfig();
  if (!repoPath) {
    throw new Error(
      'No local repository configured. Set it on the Settings tab first.',
    );
  }
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repository directory does not exist: ${repoPath}`);
  }
  if (!fs.existsSync(input.sourcePath)) {
    throw new Error(`Source PDF not found: ${input.sourcePath}`);
  }

  const payload = loadCustomFamily(input.familyId);
  if (!payload) throw new Error(`Family '${input.familyId}' not found.`);

  const sub = payload.subfamilies.find((s) => s.id === input.subfamilyId);
  if (!sub) throw new Error(`Subfamily '${input.subfamilyId}' not found.`);
  const dev = payload.devices.find((d) => d.id === input.deviceId);
  if (!dev || dev.subfamilyId !== input.subfamilyId) {
    throw new Error(`Device '${input.deviceId}' not found under that subfamily.`);
  }

  const docId = sanitizeDocId(input.docId);
  if (!docId) throw new Error('Document ID is empty.');
  if (payload.documents.some((d) => d.id === docId)) {
    throw new Error(`Document id '${docId}' already exists in this family.`);
  }
  const targetPdf = pdfPath(repoPath, docId);
  if (fs.existsSync(targetPdf)) {
    throw new Error(
      `A file '${docId}.pdf' already exists in the repository. Choose a different id.`,
    );
  }

  // Copy first; if the on-disk record write fails we'll roll the copy back.
  fs.copyFileSync(input.sourcePath, targetPdf);
  try {
    const stat = fs.statSync(targetPdf);
    const today = new Date().toISOString().slice(0, 10);
    const doc: DocumentEntry = {
      id: docId,
      subfamilyIds: [sub.id],
      type: input.type,
      title: input.title.trim() || docId,
      url: '',
      versions: [
        {
          version: (input.version ?? '1.0').trim() || '1.0',
          lastUpdate: input.lastUpdate ?? today,
          pdfCreated: stat.mtime.toISOString(),
          pdfBytes: stat.size,
        },
      ],
    };
    payload.documents.push(doc);

    // Wire it into the device + subfamily.
    if (input.type === 'Datasheet' && !dev.datasheetId) {
      dev.datasheetId = docId;
    } else {
      dev.documentIds = dev.documentIds ?? [];
      if (!dev.documentIds.includes(docId)) dev.documentIds.push(docId);
    }
    sub.documentIds = sub.documentIds ?? [];
    if (!sub.documentIds.includes(docId)) sub.documentIds.push(docId);

    saveCustomFamily(payload);

    // Best-effort sidecar so version-on-open checks recognise it. Failure
    // here doesn't unwind the metadata write — the PDF is still findable.
    try {
      writeSidecar(repoPath, doc);
    } catch (err) {
      console.warn(`Sidecar write failed for ${docId}:`, err);
    }

    return payload;
  } catch (err) {
    try {
      fs.rmSync(targetPdf, { force: true });
    } catch {
      /* ignore — leftover file is harmless */
    }
    throw err;
  }
}

/** Link an existing document (already in this family) to another device.
 *  Used when two devices share the same datasheet / RM / etc. — no new PDF
 *  is copied, just metadata wires up. */
export function linkExistingDocumentToDevice(
  familyId: string,
  deviceId: string,
  docId: string,
): CustomFamilyPayload {
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const dev = payload.devices.find((d) => d.id === deviceId);
  if (!dev) throw new Error(`Device '${deviceId}' not found.`);
  const doc = payload.documents.find((d) => d.id === docId);
  if (!doc) {
    throw new Error(
      `Document '${docId}' is not part of this family. Add it first via "Add new PDF".`,
    );
  }

  // Already attached?
  const isAlreadyDatasheet = dev.datasheetId === docId;
  const isInDocList = (dev.documentIds ?? []).includes(docId);
  if (isAlreadyDatasheet || isInDocList) {
    throw new Error(`'${docId}' is already attached to '${deviceId}'.`);
  }

  // Wire up. Datasheet docs go on `datasheetId` when free, otherwise into
  // documentIds (matches the addDocumentToFamily rule so the chip surfaces
  // in the right place for the second device).
  if (doc.type === 'Datasheet' && !dev.datasheetId) {
    dev.datasheetId = docId;
  } else {
    dev.documentIds = dev.documentIds ?? [];
    dev.documentIds.push(docId);
  }

  // Make sure this device's subfamily is also recorded on the document so
  // the Documents tab can find it from any subfamily it now lives under.
  if (!doc.subfamilyIds.includes(dev.subfamilyId)) {
    doc.subfamilyIds.push(dev.subfamilyId);
  }
  // And the subfamily's documentIds bag.
  const sub = payload.subfamilies.find((s) => s.id === dev.subfamilyId);
  if (sub) {
    sub.documentIds = sub.documentIds ?? [];
    if (!sub.documentIds.includes(docId)) sub.documentIds.push(docId);
  }

  return saveCustomFamily(payload);
}

export function renameDocument(
  familyId: string,
  docId: string,
  updates: { title?: string; type?: string; version?: string },
): CustomFamilyPayload {
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const doc = payload.documents.find((d) => d.id === docId);
  if (!doc) throw new Error(`Document '${docId}' not found.`);
  if (typeof updates.title === 'string' && updates.title.trim()) {
    doc.title = updates.title.trim();
  }
  if (typeof updates.type === 'string' && updates.type.trim()) {
    doc.type = updates.type.trim();
  }
  if (typeof updates.version === 'string' && updates.version.trim()) {
    const live = doc.versions[doc.versions.length - 1];
    if (live) live.version = updates.version.trim();
  }
  return saveCustomFamily(payload);
}

export function deleteDocument(
  familyId: string,
  docId: string,
  options: { deletePdf: boolean },
): { removedPdf: boolean } {
  const payload = loadCustomFamily(familyId);
  if (!payload) throw new Error(`Family '${familyId}' not found.`);
  const doc = payload.documents.find((d) => d.id === docId);
  if (!doc) throw new Error(`Document '${docId}' not found.`);

  payload.documents = payload.documents.filter((d) => d.id !== docId);
  for (const sub of payload.subfamilies) {
    sub.documentIds = (sub.documentIds ?? []).filter((id) => id !== docId);
  }
  for (const dev of payload.devices) {
    if (dev.datasheetId === docId) delete dev.datasheetId;
    if (dev.documentIds) {
      dev.documentIds = dev.documentIds.filter((id) => id !== docId);
    }
  }
  saveCustomFamily(payload);

  let removedPdf = false;
  if (options.deletePdf) {
    const { repoPath } = loadConfig();
    if (repoPath) {
      const pdf = pdfPath(repoPath, docId);
      const sidecar = sidecarPath(repoPath, docId);
      try {
        if (fs.existsSync(pdf)) {
          fs.rmSync(pdf, { force: true });
          removedPdf = true;
        }
        if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
      } catch (err) {
        console.warn(`Failed to remove PDF for ${docId}:`, err);
      }
    }
  }
  return { removedPdf };
}

/* -------------------------------------------------------------------------
 * Export / import (zip with family.json + every referenced PDF)
 * ---------------------------------------------------------------------- */

export interface ExportFamilyResult {
  zipPath: string;
  documentCount: number;
}

export function exportCustomFamilyZip(id: string, savePath: string): ExportFamilyResult {
  const { repoPath } = loadConfig();
  if (!repoPath) {
    throw new Error('No local repository configured.');
  }
  const payload = loadCustomFamily(id);
  if (!payload) throw new Error(`Family '${id}' not found.`);

  // Verify every referenced PDF exists BEFORE we start producing the zip.
  const missing: string[] = [];
  for (const doc of payload.documents) {
    const pdf = pdfPath(repoPath, doc.id);
    if (!fs.existsSync(pdf)) missing.push(doc.id);
  }
  if (missing.length > 0) {
    throw new Error(
      `Cannot export: ${missing.length} PDF(s) missing from the repository: ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
    );
  }

  const zip = new AdmZip();
  zip.addFile(
    'family.json',
    Buffer.from(JSON.stringify(payload, null, 2), 'utf8'),
  );
  for (const doc of payload.documents) {
    zip.addLocalFile(pdfPath(repoPath, doc.id), 'pdfs');
  }
  zip.writeZip(savePath);
  return { zipPath: savePath, documentCount: payload.documents.length };
}

export interface ImportFamilyOptions {
  /** When set, overrides the family id and name from the zip with this
   * value (sanitized). Used to resolve collisions with existing families. */
  renameTo?: string;
}

export interface ImportFamilyResult {
  familyId: string;
  familyName: string;
  documentCount: number;
  importedPdfs: number;
  skippedExistingPdfs: number;
}

export function importCustomFamilyZip(
  zipPath: string,
  options: ImportFamilyOptions = {},
): ImportFamilyResult {
  const { repoPath } = loadConfig();
  if (!repoPath) throw new Error('No local repository configured.');
  if (!fs.existsSync(repoPath)) {
    throw new Error(`Repository directory does not exist: ${repoPath}`);
  }
  if (!fs.existsSync(zipPath)) throw new Error(`Zip not found: ${zipPath}`);

  let payload: CustomFamilyPayload;
  const pdfBuffers = new Map<string, Buffer>();
  try {
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();
    const familyEntry = entries.find((e) => path.posix.basename(e.entryName) === 'family.json' && !e.entryName.includes('pdfs/'));
    if (!familyEntry) throw new Error('Zip is missing family.json.');
    payload = JSON.parse(familyEntry.getData().toString('utf8')) as CustomFamilyPayload;
    if (!payload.family || !Array.isArray(payload.documents)) {
      throw new Error('family.json is malformed.');
    }
    for (const e of entries) {
      if (e.isDirectory) continue;
      if (!/\.pdf$/i.test(e.entryName)) continue;
      pdfBuffers.set(path.posix.basename(e.entryName), e.getData());
    }
  } catch (err) {
    throw new Error(`Invalid zip: ${(err as Error).message}`);
  }

  // Verify every referenced PDF is present in the zip.
  const missing = payload.documents
    .map((d) => `${d.id}.pdf`)
    .filter((name) => !pdfBuffers.has(name));
  if (missing.length > 0) {
    throw new Error(
      `Zip is missing ${missing.length} referenced PDF(s): ${missing.slice(0, 5).join(', ')}${missing.length > 5 ? '…' : ''}`,
    );
  }

  // Pick the target family id.
  const proposedName = options.renameTo?.trim() || payload.family.name;
  const baseId = options.renameTo
    ? sanitizeFamilyId(options.renameTo)
    : sanitizeFamilyId(payload.family.id);
  if (!baseId || isReservedId(baseId)) {
    throw new Error(
      `Cannot use '${baseId}' as a family id. Provide a different name when importing.`,
    );
  }
  if (fs.existsSync(customFamilyDir(baseId))) {
    throw new Error(
      `A custom family named '${baseId}' already exists. Pass a different name to import as.`,
    );
  }

  // Verify repo collisions: refuse if a same-named PDF exists with a
  // different content. Same content → safe to keep using.
  let importedPdfs = 0;
  let skippedExistingPdfs = 0;
  for (const doc of payload.documents) {
    const target = pdfPath(repoPath, doc.id);
    const incoming = pdfBuffers.get(`${doc.id}.pdf`);
    if (!incoming) continue; // already validated above, defensive
    if (fs.existsSync(target)) {
      const existing = fs.readFileSync(target);
      if (!existing.equals(incoming)) {
        throw new Error(
          `Repository already has a different '${doc.id}.pdf'. Resolve the conflict before importing.`,
        );
      }
      skippedExistingPdfs++;
    }
  }

  // Apply renames (only the family-level id; subfamily/device ids are
  // user-chosen and we keep them as-is).
  if (baseId !== payload.family.id) {
    const oldId = payload.family.id;
    payload.family.id = baseId;
    if (options.renameTo) payload.family.name = proposedName;
    for (const sub of payload.subfamilies) {
      if (sub.familyId === oldId) sub.familyId = baseId;
    }
  }

  // Stage 2 — actually write things.
  for (const doc of payload.documents) {
    const target = pdfPath(repoPath, doc.id);
    if (!fs.existsSync(target)) {
      const buf = pdfBuffers.get(`${doc.id}.pdf`);
      if (buf) {
        fs.writeFileSync(target, buf);
        importedPdfs++;
      }
    }
    // Best-effort sidecar
    try {
      writeSidecar(repoPath, doc);
    } catch {
      /* ignore */
    }
  }
  saveCustomFamily(payload);

  return {
    familyId: payload.family.id,
    familyName: payload.family.name,
    documentCount: payload.documents.length,
    importedPdfs,
    skippedExistingPdfs,
  };
}
