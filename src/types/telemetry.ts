export interface TelemetryPoint {
  /** Distance along the racing line in meters */
  distance: number;
  /** Cumulative lap time in seconds */
  time: number;
  /** Vehicle speed in km/h */
  speed: number;
  /** Normalized throttle position (0.00 to 1.00) */
  throttle: number;
  /** Normalized brake pressure/position (0.00 to 1.00) */
  brake: number;
  /** Current transmission gear (1 to 8) */
  gear: number;
  /** Engine revolutions per minute */
  rpm: number;
  /** Steering wheel angle in degrees (-180 to 180 deg) */
  steeringAngle: number;
  /** Lateral acceleration in Gs (-5.0 to 5.0 G) */
  gLat: number;
  /** Longitudinal acceleration in Gs (-5.0 to 2.5 G) */
  gLong: number;
  /** Optional true GPS coordinates */
  x?: number;
  y?: number;
}

export interface SectorSplit {
  /** Sector index (1 to 3) */
  sectorIndex: 1 | 2 | 3;
  /** Distance marker along the track in meters */
  distanceMarker: number;
  /** Cumulative split time for Lap 1 (Reference) in seconds */
  splitTimeLap1: number;
  /** Cumulative split time for Lap 2 (Comparison) in seconds */
  splitTimeLap2: number;
  /** Delta time in seconds (splitTimeLap2 - splitTimeLap1; positive = Lap 2 is slower) */
  deltaSeconds: number;
}

export interface DriverMeta {
  driverNumber: number;
  driverCode: string; // e.g. 'LEC', 'VER', 'HAM', 'NOR'
  driverName: string; // e.g. 'Charles Leclerc'
  teamName: string; // e.g. 'Scuderia Ferrari'
  teamColor: string; // hex color e.g. '#e8002d'
  carModel: string; // e.g. 'Ferrari SF-24'
  lapTimeFormatted?: string; // e.g. '1:19.461'
  lapTimeSeconds?: number;
}

export interface OpenF1Meeting {
  meeting_key: number;
  meeting_name: string;
  meeting_official_name?: string;
  location: string;
  country_name: string;
  circuit_key: number;
  circuit_short_name: string;
  date_start: string;
  gmt_offset: string;
  year: number;
}

export interface OpenF1Session {
  session_key: number;
  session_name: string;
  session_type: string;
  date_start: string;
  date_end: string;
  gmt_offset: string;
  meeting_key: number;
  year: number;
}

export interface OpenF1Driver {
  driver_number: number;
  broadcast_name: string;
  full_name: string;
  name_acronym: string;
  team_name: string;
  team_colour: string;
  session_key: number;
  meeting_key: number;
  headshot_url?: string;
  country_code?: string;
}

export interface OpenF1Lap {
  lap_number: number;
  lap_duration: number | null;
  date_start: string;
  duration_sector_1: number | null;
  duration_sector_2: number | null;
  duration_sector_3: number | null;
  i1_speed?: number | null;
  i2_speed?: number | null;
  st_speed?: number | null;
  is_pit_out_lap?: boolean;
}

export interface SessionConfig {
  id: string; // 'benchmark-demo' | 'monza-real-f1' | 'custom-upload' | dynamic id
  name: string;
  car: string;
  track: string;
  isRealData: boolean;
  meetingKey?: number;
  sessionKey?: number;
  year?: number;
  circuitShortName?: string;
  refDriver?: string;
  compDriver?: string;
  refLapTime?: string;
  compLapTime?: string;
  driver1Meta?: DriverMeta;
  driver2Meta?: DriverMeta;
}

export interface TelemetrySession extends SessionConfig {
  trackName: string;
  carName: string;
  referenceLap: TelemetryPoint[];
  comparisonLap: TelemetryPoint[];
  sectors: SectorSplit[];
}
