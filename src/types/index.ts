
export interface Publication {
  id: string;
  authors: string;
  title: string;
  year: number;
  source: string;
  jufoLevel?: number | null;
  norwegianLevel?: number | null;
  indexed: boolean;
  checked: boolean;
}

export interface JufoResponse {
  level: number | null;
  norwegianLevel?: number | null;
  indexed: boolean;
}

export interface JufoData {
  name: string;
  issn: string;
  level: number;
  norwegianLevel?: number | null;
  publisher: string;
  type: string;
}

export interface ImportResult {
  success: boolean;
  count?: number;
  error?: string;
}
