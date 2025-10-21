export type Master = Record<string, string[]>;

export type IntakeTicket = {
  ticketId: string;
  factory: string;
  date: string;
  purchaseDate: string;
  person: string;
  species: string;
  supplier: string;
  ozone: string;
  ozone_person: string;
  visual_toxic: string;
  visual_toxic_note: string;
  admin: string;
};

export type InventoryReport = {
  ticketId: string;
  purchaseDate: string;
  date: string;
  person: string;
  factory: string;
  species: string;
  origin: string;
  state: string;
  kg: string;
  visual_parasite: string;
  visual_foreign: string;
};

export type SubmissionState = 'idle' | 'submitting' | 'success' | 'error';
