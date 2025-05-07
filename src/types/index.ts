
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
  evaluated?: boolean;
}

export interface JufoResponse {
  level: number | null;
  norwegianLevel?: number | null;
  indexed: boolean;
  evaluated: boolean;
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
