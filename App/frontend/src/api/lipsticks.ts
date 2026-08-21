import { api } from '@/lib/httpClient';

export interface LipstickItem {
  id: string;
  color_hex: string;
  brand: string;
  shade_name: string;
  product_line: string;
  product_type: string;
  color_family: string;
  undertone: string;
  undertone_confidence: number;
  color_depth: string;
  finish: string;
  finish_confidence: number;
  color_rgb: { r: number; g: number; b: number };
  color_hsl: { h: number; s: number; l: number };
  brightness: number;
  saturation: number;
  hue_degree: number;
  color_family_confidence: number;
  recommended_skin_undertone: string[];
  recommended_skin_depth: string[];
  seasonal_palette: string;
  distance?: number;
  match_score?: number;
  same_brand?: boolean;
}

export interface FiltersData {
  brands: string[];
  color_families: string[];
  undertones: string[];
  finishes: string[];
  color_depths: string[];
  seasonal_palettes: string[];
  total_count: number;
}

export interface LipstickPage {
  items: LipstickItem[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface SemanticSearchResult extends LipstickPage {
  parsed_query: Record<string, string> | null;
}

export interface ListLipsticksParams {
  page?: number;
  page_size?: number;
  brand?: string;
  color_family?: string;
  undertone?: string;
  finish?: string;
  color_depth?: string;
  seasonal_palette?: string;
  keyword?: string;
}

export async function getFilters(): Promise<FiltersData> {
  return api.get<FiltersData>('/api/v1/lipsticks/filters');
}

export async function listLipsticks(
  params: ListLipsticksParams
): Promise<LipstickPage> {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value));
    }
  });
  return api.get<LipstickPage>(`/api/v1/lipsticks?${search.toString()}`);
}

export async function searchByColor(
  hex: string,
  limit = 20
): Promise<{ items: LipstickItem[]; results?: LipstickItem[] }> {
  return api.get(
    `/api/v1/lipsticks/search-by-color?hex=${encodeURIComponent(hex)}&limit=${limit}`
  );
}

export async function getDupes(
  lipstickId: string,
  limit = 10
): Promise<{ source: LipstickItem; dupes: LipstickItem[] }> {
  return api.get(`/api/v1/lipsticks/${lipstickId}/dupes?limit=${limit}`);
}

export async function semanticSearch(
  query: string,
  page = 1,
  pageSize = 10
): Promise<SemanticSearchResult> {
  const params = new URLSearchParams({
    q: query,
    page: String(page),
    page_size: String(pageSize),
  });
  return api.get(`/api/v1/lipsticks/semantic-search?${params.toString()}`);
}

export async function recommendBySkin(
  undertone: string,
  depth: string,
  page = 1,
  pageSize = 40
): Promise<LipstickPage> {
  return api.post('/api/v1/lipsticks/recommend-by-skin', { undertone, depth }, {
    params: { page, page_size: pageSize },
  });
}

export async function findFromImage(
  rgb: { r: number; g: number; b: number },
  limit = 10
): Promise<{ matches: LipstickItem[] }> {
  return api.post('/api/v1/lipsticks/find-from-image?limit=10', rgb);
}

export async function getColorUniverse(
  family: string,
  page = 1,
  pageSize = 60
): Promise<LipstickPage> {
  return api.get(
    `/api/v1/lipsticks/color-universe/${family}?page=${page}&page_size=${pageSize}`
  );
}