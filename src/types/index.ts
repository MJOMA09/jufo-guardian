
export interface Publication {
  id: string;
  authors: string;
  title: string;
  year: number;
  source: string;
  jufoLevel?: number | string | null;
  norwegianLevel?: number | null;
  indexed: boolean;
  checked: boolean;
  evaluated?: boolean;
  issn?: string;
  issnPrint?: string;
  issnOnline?: string;
  isbn?: string;
  doi?: string;
  status?: 'Indexed' | 'Not Indexed' | 'Pending';
}

export interface JufoResponse {
  level: number | string | null;
  norwegianLevel?: number | null;
  indexed: boolean;
  evaluated: boolean;
  checked?: boolean;
}

export interface JufoData {
  name: string;
  issn: string;
  level: number;
  norwegianLevel?: number | null;
  publisher: string;
  type: string;
  year?: number;
  evaluated: boolean;
}

export interface ImportResult {
  success: boolean;
  count?: number;
  error?: string;
}
