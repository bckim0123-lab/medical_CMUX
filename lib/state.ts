// Orchestration State — agents read from and write to this shape.
// Designed to be 1:1 transferable to LangGraph StateGraph state later.

export type Hospital = {
  id: string;
  name: string;
  gu: string;
  lng: number;
  lat: number;
  specialty: string;
};

export type PopulationDong = {
  gu: string;
  dong: string;
  populationU5: number;
  centroid: [number, number];
};

export type RiskGrade = 'High' | 'Mid' | 'Low';

export type GuCoverage = {
  gu: string;
  hospitalCount: number;
  populationU5: number;
  uncoveredPopulationU5: number;
  uncoveredRatio: number;
  riskGrade: RiskGrade;
};

export type CoverageResult = {
  bufferKm: number;
  vulnerableAreaKm2: number;
  totalAreaKm2: number;
  vulnerableRatio: number;
  riskGrade: RiskGrade;
  vulnerableGeoJSON: GeoJSON.FeatureCollection;
  bufferGeoJSON: GeoJSON.FeatureCollection;
  byGu: GuCoverage[];
};

export type PolicyOption = {
  id: string;
  type: 'NewCenter' | 'ShuttleLink' | 'TelemedHub';
  title: string;
  targetGu: string;
  location: [number, number];
  expectedCoverageGainPct: number;
  estimatedCostKrw: number;
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
