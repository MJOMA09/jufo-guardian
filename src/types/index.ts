
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
