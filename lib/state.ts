// Orchestration State — agents read from and write to this shape.
// Designed to be 1:1 transferable to LangGraph StateGraph state later.

export type Hospital = {
  id: string;
  name: string;
  lng: number;
  lat: number;
  specialty: string;
};

export type PopulationDong = {
  dong: string;
  populationU5: number;
  centroid: [number, number];
};

export type CoverageResult = {
  bufferKm: number;
  vulnerableAreaKm2: number;
  riskGrade: 'High' | 'Mid' | 'Low';
  vulnerableGeoJSON: GeoJSON.FeatureCollection;
};

export type PolicyOption = {
  title: string;
  location: [number, number];
  expectedCoverageGain: number;
  rationale: string;
};

export type OrchestrationState = {
  region: string;
  hospitals?: Hospital[];
  population?: PopulationDong[];
  coverage?: CoverageResult;
  options?: PolicyOption[];
  report?: string;
};
