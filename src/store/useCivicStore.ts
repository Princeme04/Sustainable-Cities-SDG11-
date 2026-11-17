import { create } from 'zustand';
import type {
  CivicReport,
  Coordinates,
  HazardZone,
  PermissionStatus,
} from '../types/civic';

// Realistic mock reports around Malang, East Java, Indonesia
const MOCK_REPORTS: CivicReport[] = [
  {
    id: 'rpt-001',
    title: 'Jl. Ijen Flooding After Heavy Rain',
    category: 'FLOOD',
    severity: 'HIGH',
    coordinates: { latitude: -7.9725, longitude: 112.6311 },
    timestamp: Date.now() - 3_600_000,
    photoUri: null,
  },
  {
    id: 'rpt-002',
    title: 'Pothole on Jl. Soekarno-Hatta',
    category: 'ROAD_DAMAGE',
    severity: 'MEDIUM',
    coordinates: { latitude: -7.9455, longitude: 112.6155 },
    timestamp: Date.now() - 7_200_000,
    photoUri: null,
  },
  {
    id: 'rpt-003',
    title: 'Fallen Banyan Tree near Alun-Alun Malang',
    category: 'FALLEN_TREE',
    severity: 'CRITICAL',
    coordinates: { latitude: -7.9784, longitude: 112.6320 },
    timestamp: Date.now() - 1_800_000,
    photoUri: null,
  },
  {
    id: 'rpt-004',
    title: 'Minor Landslide at Batu Hillside',
    category: 'LANDSLIDE',
    severity: 'HIGH',
    coordinates: { latitude: -7.8830, longitude: 112.5260 },
    timestamp: Date.now() - 10_800_000,
    photoUri: null,
  },
  {
    id: 'rpt-005',
    title: 'Road Crack on Jl. Veteran',
    category: 'ROAD_DAMAGE',
    severity: 'LOW',
    coordinates: { latitude: -7.9636, longitude: 112.6150 },
    timestamp: Date.now() - 5_400_000,
    photoUri: null,
  },
];

const MOCK_HAZARD_ZONES: HazardZone[] = [
  {
    id: 'hz-001',
    name: 'Brantas River Flood Plain',
    center: { latitude: -7.9700, longitude: 112.6350 },
    radiusMeters: 500,
    riskLevel: 'HIGH',
  },
  {
    id: 'hz-002',
    name: 'Batu Landslide Corridor',
    center: { latitude: -7.8830, longitude: 112.5260 },
    radiusMeters: 750,
    riskLevel: 'EXTREME',
  },
];

interface CivicState {
  userLocation: Coordinates | null;
  locationPermissionStatus: PermissionStatus;
  reports: CivicReport[];
  hazardZones: HazardZone[];
}

interface CivicActions {
  setUserLocation: (location: Coordinates) => void;
  setPermissionStatus: (status: PermissionStatus) => void;
  addReport: (report: CivicReport) => void;
}

type CivicStore = CivicState & CivicActions;

export const useCivicStore = create<CivicStore>((set) => ({
  userLocation: null,
  locationPermissionStatus: 'undetermined',
  reports: MOCK_REPORTS,
  hazardZones: MOCK_HAZARD_ZONES,

  setUserLocation: (location) =>
    set({ userLocation: location }),

  setPermissionStatus: (status) =>
    set({ locationPermissionStatus: status }),

  addReport: (report) =>
    set((state) => ({ reports: [...state.reports, report] })),
}));
