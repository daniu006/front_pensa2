// speakerInterface.ts - CÓDIGO COMPLETO CORREGIDO
export interface HistoryItem {
  id: number;
  usageSessionId: number;
  speakerId: number;
  speakerName: string;
  speakerPosition: string;
  userId: number;
  startDate: Date;
  endDate: Date;
  durationMinutes: number | null;
  
  // 🔥 CAMPOS NUMÉRICOS SIEMPRE COMO NUMBER (YA TRANSFORMADOS)
  avgCurrent_mA: number;
  avgVoltage_V: number;
  avgPower_mW: number;
  
  totalCurrent_mA: number;
  totalVoltage_V: number;
  totalPower_mW: number;
  totalConsumed_mAh: number;
  
  // Información de batería
  initialBatteryPercentage: number;
  finalBatteryPercentage: number;
  batteryConsumed: number;
  
  createdAt: Date;
  
  // Usuario asociado
  user?: {
    id: number;
    username: string;
    email: string;
  } | null;
}

