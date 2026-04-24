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
  url?: string;
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
