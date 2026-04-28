import { deepOrange, lightBlue, lightGreen, red } from '@mui/material/colors';

export type DocKind = 'DS' | 'RM' | 'PM' | 'ES';

export const DOC_KINDS: DocKind[] = ['DS', 'RM', 'PM', 'ES'];

export const KIND_LONG_LABEL: Record<DocKind, string> = {
  DS: 'Datasheet',
  RM: 'Reference manual',
  PM: 'Programming manual',
  ES: 'Errata sheet',
};

export const KIND_COLORS: Record<DocKind, { bg: string; hover: string }> = {
  DS: { bg: deepOrange[700], hover: deepOrange[900] },
  RM: { bg: lightBlue[700], hover: lightBlue[900] },
  PM: { bg: lightGreen[700], hover: lightGreen[900] },
  ES: { bg: red[700], hover: red[900] },
};

export const KIND_BY_DOCTYPE: Record<string, DocKind | undefined> = {
  Datasheet: 'DS',
  'Reference Manual': 'RM',
  'Programming Manual': 'PM',
  'Errata Sheet': 'ES',
};

export const KIND_ORDER: Record<DocKind, number> = {
  DS: 0,
  RM: 1,
  PM: 2,
  ES: 3,
};

/** Short label per ST document type for the "Other documentation" dialog
 * (everything that isn't a main DS/RM/PM/ES chip on the card). */
export const OTHER_DOC_LABELS: Record<string, string> = {
  'Application Note': 'AN',
  'Technical Note': 'TN',
  'User Manual': 'UM',
  'Security Bulletin': 'SB',
  'Security Advisory': 'SA',
  'Security Target': 'ST',
  'Security Guidance': 'SG',
  'Design Tip': 'DT',
  'Design Note': 'DN',
  'Material Declaration': 'MD',
  'Data Brief': 'DB',
};

export function shortLabelForType(type: string): string {
  return OTHER_DOC_LABELS[type] ?? type.slice(0, 2).toUpperCase();
}
