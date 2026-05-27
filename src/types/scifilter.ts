export type Feedback = "relevant" | "maybe_relevant" | "not_relevant" | null;

export interface Paper {
  id?: string;
  doi: string | null;
  title: string;
  authors: string;
  year: number | null;
  source: string;
  abstract: string;
  url: string;
  citations: number;
  concepts: string[];
  relevance: "High" | "Medium" | "Low";
  relevance_score: number;
  confidence?: number;
  summary?: string;
  methodology?: string;
  applicability?: "High" | "Medium" | "Low" | "Unknown";
  explanation: string;
  feedback?: Feedback;
  related_authors?: { name: string; works?: number }[];
  reason_breakdown?: {
    semantic?: number;
    methodology?: number;
    topic?: number;
    author?: number;
    citation?: number;
    keyword_matches?: string;
  };
  collection_id?: string | null;
}

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  is_shared: boolean;
  created_at: string;
}

export interface Annotation {
  id: string;
  paper_id: string;
  user_id: string;
  content: string;
  kind: "finding" | "note" | "handover";
  is_shared: boolean;
  created_at: string;
}

export interface Comment {
  id: string;
  paper_id: string;
  user_id: string;
  content: string;
  created_at: string;
}
