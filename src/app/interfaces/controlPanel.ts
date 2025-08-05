// ===== INTERFACES PARA EL CONTROL PANEL =====

export interface EnergyMetrics {
  voltage_V: number;
  current_mA: number;
  power_mW: number;
  battery_remaining_percent: number;
  timestamp: number;
  total_consumed_mAh: number;
  sample_index: number;
}

export interface SessionData {
  id: number;
  speakerId: number;
  userId: number;
  startTime: string;
  endTime?: string;
  initialBatteryPercentage: number;
  finalBatteryPercentage?: number;
  durationMinutes: number;
  status: 'active' | 'completed' | 'error';
  energyMeasurements?: EnergyMetrics[];
  speaker?: SpeakerInfo;
  user?: UserInfo;
}

export interface SpeakerInfo {
  name: string;
  position: string;
}

export interface UserInfo {
  id: number;
  username: string;
  email: string;
  role?: 'admin' | 'user';
}

export interface RealtimeSessionData {
  sessionId: number;
  speakerId: number;
  speakerName: string;
  userId: number;
  status: string;
  startTime: string;
  durationMinutes: number;
  initialBatteryPercentage: number;
  
  latestData: {
    timestamp: number;
    current_mA: number;
    voltage_V: number;
    power_mW: number;
    battery_remaining_percent: number;
    total_consumed_mAh: number;
    sample_index: number;
  };
  
  statistics: {
    avgCurrent_mA: number;
    avgVoltage_V: number;
    avgPower_mW: number;
    peakPower_mW: number;
    measurementCount: number;
    totalConsumed_mAh: number;
    durationSeconds: number;
  };
  
  hasRealtimeData: boolean;
  lastUpdated: string;
}

export interface VolumeControl {
  currentVolume: number;
  minVolume: number;
  maxVolume: number;
  status: 'idle' | 'updating' | 'error';
  lastUpdate?: Date;
  presets: number[];
}

export interface SystemStatus {
  isConnected: boolean;
  optimizedMode: boolean;
  pollingInterval: number;
  lastPollTime?: Date;
  errorCount: number;
  uptime: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp?: string;
  error?: {
    code: string;
    details: string;
  };
}

export interface SessionControlPayload {
  speakerId: number;
  userId: number;
  initialBatteryPercentage: number;
  mode: 'standard' | 'optimized' | 'ultra_optimized';
  initialVolume?: number;
  settings?: {
    pollingInterval?: number;
    saveInterval?: number;
    enableRealtime?: boolean;
  };
}

export interface EndSessionPayload {
  finalBatteryPercentage: number;
  totalMeasurementsSent: number;
  totalConsumed_mAh: number;
  sessionDurationSeconds: number;
  avgCurrent_mA: number;
  avgVoltage_V: number;
  avgPower_mW: number;
  peakPower_mW: number;
  mode: string;
  additionalStats?: {
    minPower_mW?: number;
    efficiency?: number;
    qualityScore?: number;
  };
}

export interface VolumeCommandPayload {
  volume: number;
  speakerId: number;
  sessionId: number | null;
  timestamp: string;
  action?: 'set' | 'increase' | 'decrease' | 'sync';
}

export interface ConnectionInfo {
  esp32Url: string;
  backendUrl: string;
  pollingInterval: number;
  timeoutMs: number;
  retryAttempts: number;
  lastConnection?: Date;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'disconnected';
}

// ===== TIPOS DE UTILIDAD =====
export type BatteryLevel = 'excellent' | 'good' | 'acceptable' | 'low' | 'critical' | 'very_critical';
export type VolumeLevel = 'very_low' | 'low' | 'medium' | 'high' | 'maximum';
export type SessionStatus = 'idle' | 'starting' | 'active' | 'pausing' | 'stopping' | 'error';
export type DataFreshness = 'fresh' | 'recent' | 'stale' | 'obsolete';

// ===== CONSTANTES =====
export const VOLUME_CONSTANTS = {
  MIN: 5,
  MAX: 30,
  DEFAULT: 25,
  PRESETS: [5, 10, 15, 20, 25, 30]
} as const;

export const POLLING_CONSTANTS = {
  ULTRA_OPTIMIZED: 2000, // 2 segundos
  OPTIMIZED: 3000,       // 3 segundos
  STANDARD: 5000,        // 5 segundos
  SLOW: 10000           // 10 segundos
} as const;

export const BATTERY_THRESHOLDS = {
  EXCELLENT: 80,
  GOOD: 60,
  ACCEPTABLE: 40,
  LOW: 20,
  CRITICAL: 10
} as const;

// ===== INTERFACES PARA EVENTOS =====
export interface SessionEvent {
  type: 'start' | 'stop' | 'pause' | 'resume' | 'error' | 'data_update';
  timestamp: Date;
  sessionId: number;
  data?: any;
  error?: string;
}

export interface VolumeEvent {
  type: 'change' | 'error' | 'sync';
  timestamp: Date;
  volume: number;
  previousVolume?: number;
  success: boolean;
  error?: string;
}

export interface DataUpdateEvent {
  timestamp: Date;
  sessionId: number;
  measurementCount: number;
  latestMetrics: EnergyMetrics;
  statistics: RealtimeSessionData['statistics'];
  dataQuality: 'good' | 'fair' | 'poor';
}

// ===== INTERFACES PARA CONFIGURACIÓN =====
export interface PanelConfiguration {
  theme: 'light' | 'dark' | 'auto';
  animations: boolean;
  notifications: boolean;
  autoSave: boolean;
  debugMode: boolean;
  expertMode: boolean;
  refreshRate: 'slow' | 'normal' | 'fast' | 'ultra';
}

export interface AdvancedSettings {
  connectionTimeout: number;
  maxRetries: number;
  bufferSize: number;
  compressionEnabled: boolean;
  encryptionEnabled: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

// ===== VALIDADORES DE TIPOS =====
export const isValidVolume = (volume: number): boolean => {
  return volume >= VOLUME_CONSTANTS.MIN && volume <= VOLUME_CONSTANTS.MAX;
};

export const isValidSessionData = (data: any): data is RealtimeSessionData => {
  return data && 
         typeof data.sessionId === 'number' &&
         typeof data.hasRealtimeData === 'boolean' &&
         data.latestData &&
         data.statistics;
};

export const getBatteryLevel = (percentage: number): BatteryLevel => {
  if (percentage > BATTERY_THRESHOLDS.EXCELLENT) return 'excellent';
  if (percentage > BATTERY_THRESHOLDS.GOOD) return 'good';
  if (percentage > BATTERY_THRESHOLDS.ACCEPTABLE) return 'acceptable';
  if (percentage > BATTERY_THRESHOLDS.LOW) return 'low';
  if (percentage > BATTERY_THRESHOLDS.CRITICAL) return 'critical';
  return 'very_critical';
};

export const getVolumeLevel = (volume: number): VolumeLevel => {
  const percent = (volume / VOLUME_CONSTANTS.MAX) * 100;
  if (percent <= 20) return 'very_low';
  if (percent <= 40) return 'low';
  if (percent <= 60) return 'medium';
  if (percent <= 80) return 'high';
  return 'maximum';
};

export const getDataFreshness = (lastUpdate: string): DataFreshness => {
  const now = new Date();
  const update = new Date(lastUpdate);
  const diffSeconds = Math.floor((now.getTime() - update.getTime()) / 1000);
  
  if (diffSeconds < 5) return 'fresh';
  if (diffSeconds < 10) return 'recent';
  if (diffSeconds < 30) return 'stale';
  return 'obsolete';
};