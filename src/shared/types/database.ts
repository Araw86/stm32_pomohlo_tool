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
  /** Doc IDs scraped from this device's own documentation tab.
   * Populated only when the device's subfamily is ambiguous and
   * deep-mode was used; otherwise inherit from the subfamily. */
  documentIds?: string[];
  /** ISO timestamp of the last deep-mode scrape for this device. */
  scrapedAt?: string;
}

export interface DocumentVersion {
  version: string;
  lastUpdate: string;
  supersededAt: string;
}

export interface DocumentEntry {
  id: string;
  subfamilyIds: string[];
  type: string;
  title: string;
  version: string;
  lastUpdate: string;
  url: string;
  history?: DocumentVersion[];
}

export interface DatabasePayload {
  families: Family[];
  subfamilies: Subfamily[];
  documents: DocumentEntry[];
  devices: Device[];
}
