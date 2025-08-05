import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { HistoryItem } from '../interfaces/speakerInterface';
import { apiURL } from './api';
import { createSpeakerApi, deleteSpeakerApi, forceShutdownApi, getActiveSessionApi, getAllHistoryApi, getBatteryLevelApi, getSpeakerByIdApi, getSpeakersApi, getSpeakerStatusApi, speakersApi, updateSpeakerApi } from '../constants/endPoints';

@Injectable({
  providedIn: 'root'
})
export class SpeakersService {
  private readonly API_URL = apiURL;

  constructor(private http: HttpClient) {}

  // 🔐 MÉTODO PARA OBTENER HEADERS CON AUTENTICACIÓN
  private getAuthHeaders(): HttpHeaders {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    
    if (!token) {
      return new HttpHeaders({
        'Content-Type': 'application/json'
      });
    }

    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    });
  }

  // 🔐 MÉTODO PARA OBTENER OPCIONES HTTP CON AUTENTICACIÓN
  private getHttpOptions() {
    return {
      headers: this.getAuthHeaders()
    };
  }

  // 🔥 FUNCIÓN HELPER OPTIMIZADA: Convertir valores a número de forma segura
  private safeToNumber(value: any, defaultValue: number = 0): number {
    if (value === null || value === undefined || value === '') {
      return defaultValue;
    }
    
    // Si es objeto Decimal de Prisma/PostgreSQL
    if (typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
      const num = Number(value.toString());
      return isNaN(num) ? defaultValue : num;
    }
    
    // Si es string o number
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  }

  // 🔥 MÉTODO OPTIMIZADO: Transformar historial SIN LOGS EXCESIVOS
  private transformHistoryItem(item: any): HistoryItem {
  // 🔥 SOLO UN LOG PER BATCH, NO PER ITEM
  const isFirstItem = item.id === 1 || Math.random() < 0.1; // Solo 10% de probabilidad de log
  
  if (isFirstItem) {
    // ✅ LOGGING MEJORADO para debug del problema de totalConsumed
    console.log(`🔍 DEBUG - Item de historial:`, {
      id: item.id,
      speakerName: item.speakerName,
      totalConsumed_raw: item.totalConsumed_mAh,
      esp32Data: item.esp32Data,
      totalAmpereHours: item.totalAmpereHours,
      // Ver todos los campos posibles para totalConsumed
      allPossibleFields: {
        totalConsumed_mAh: item.totalConsumed_mAh,
        totalConsumption: item.totalConsumption,
        totalConsumedMAh: item.totalConsumedMAh,
        total_consumed_mAh: item.total_consumed_mAh,
        totalAmpereHours: item.totalAmpereHours,
        esp32Data_totalConsumed: item.esp32Data?.totalConsumed_mAh
      }
    });
  }

  // 🔥 TRANSFORMACIÓN RÁPIDA Y DIRECTA - CORREGIDA
  const transformedItem: HistoryItem = {
    id: item.id,
    usageSessionId: item.usageSessionId,
    speakerId: item.speakerId,
    speakerName: item.speakerName || 'Desconocido',
    speakerPosition: item.speakerPosition || 'Desconocida',
    userId: item.userId,
    startDate: new Date(item.startDate),
    endDate: new Date(item.endDate),
    durationMinutes: item.durationMinutes || 0,
    
    // 🔥 CAMPOS NUMÉRICOS - USAR NOMBRES CORRECTOS DEL BACKEND
    avgCurrent_mA: this.safeToNumber(
      item.avgCurrent_mA || 
      item.avgAmpereHours || 
      item.averageCurrentMA || 
      item.average_current_mA ||
      (item.esp32Data?.avgCurrent_mA) // ← Desde esp32Data si existe
    ),
    avgVoltage_V: this.safeToNumber(
      item.avgVoltage_V || 
      item.avgVoltageHours || 
      item.averageVoltageV || 
      item.average_voltage_V ||
      (item.esp32Data?.avgVoltage_V) // ← Desde esp32Data si existe
    ),
    avgPower_mW: this.safeToNumber(
      item.avgPower_mW || 
      item.avgWattsHours || 
      item.averagePowerMW || 
      item.average_power_mW ||
      (item.esp32Data?.avgPower_mW) // ← Desde esp32Data si existe
    ),
    
    totalCurrent_mA: this.safeToNumber(
      item.totalCurrent_mA || 
      item.totalAmpereHours || 
      item.totalCurrentMA || 
      item.total_current_mA ||
      (item.totalAmpereHours * 1000) // Convertir Ah a mAh si es necesario
    ),
    totalVoltage_V: this.safeToNumber(
      item.totalVoltage_V || 
      item.totalVoltageHours || 
      item.totalVoltageV || 
      item.total_voltage_V
    ),
    totalPower_mW: this.safeToNumber(
      item.totalPower_mW || 
      item.totalWattsHours || 
      item.totalPowerMW || 
      item.total_power_mW ||
      (item.totalWattsHours * 1000) // Convertir W a mW si es necesario
    ),
    
    // ✅ CORRECCIÓN PRINCIPAL - Mapeo correcto de totalConsumed_mAh
    totalConsumed_mAh: this.safeToNumber(
      // Prioridad 1: Campo directo del ESP32Data
      item.esp32Data?.totalConsumed_mAh ||
      // Prioridad 2: Campo calculado en stats
      item.esp32Data?.calculatedStats?.totalConsumed_mAh ||
      // Prioridad 3: Campos tradicionales de la BD (convertir Ah a mAh)
      (item.totalAmpereHours ? Number(item.totalAmpereHours) * 1000 : null) ||
      // Prioridad 4: Otros campos posibles
      item.totalConsumed_mAh || 
      item.totalConsumption || 
      item.totalConsumedMAh || 
      item.total_consumed_mAh ||
      // Fallback: 0 si no se encuentra nada
      0
    ),
    
    // Información de batería
    initialBatteryPercentage: this.safeToNumber(item.initialBatteryPercentage, 100),
    finalBatteryPercentage: this.safeToNumber(item.finalBatteryPercentage, 100),
    batteryConsumed: this.safeToNumber(item.batteryConsumed, 0),
    
    createdAt: new Date(item.createdAt),
    user: item.user || null
  };

  // ✅ LOGGING DE VERIFICACIÓN para el campo problemático
  if (isFirstItem && transformedItem.totalConsumed_mAh === 0) {
    console.warn(`⚠️ totalConsumed_mAh quedó en 0 para item ${item.id}. Revisando fuentes:`, {
      esp32Data_total: item.esp32Data?.totalConsumed_mAh,
      totalAmpereHours_raw: item.totalAmpereHours,
      totalAmpereHours_converted: item.totalAmpereHours ? Number(item.totalAmpereHours) * 1000 : null,
      allFields: Object.keys(item).filter(key => key.toLowerCase().includes('consumed') || key.toLowerCase().includes('ampere'))
    });
  }

  return transformedItem;
}


  // 📊 MÉTODO OPTIMIZADO: Obtener historial de todos los parlantes
  getAllSpeakersHistory(): Observable<HistoryItem[]> {
    return this.http.get<{
      success: boolean;
      data: {
        histories: any[];
        total: number;
        page: number;
        limit: number;
      }
    }>(`${this.API_URL}${getAllHistoryApi}`, this.getHttpOptions())
    .pipe(
      map(response => {
        if (!response.success || !response.data || !response.data.histories) {
          console.error('❌ Formato de respuesta inválido');
          return [];
        }

        // 🔥 SOLO UN LOG DE RESUMEN
        const totalHistories = response.data.histories.length;
        if (totalHistories > 0) {
          console.log(`📊 Historial cargado: ${totalHistories} registros`);
        }

        // 🔥 TRANSFORMACIÓN RÁPIDA SIN LOGS POR ITEM
        return response.data.histories.map(item => this.transformHistoryItem(item));
      })
    );
  }

  // 📊 MÉTODO OPTIMIZADO: Obtener historial de parlante específico
  getSpeakerHistory(speakerId: number, limit: number = 20, page: number = 1): Observable<{
    data: {
      histories: HistoryItem[];
      total: number;
      page: number;
      limit: number;
    }
  }> {
    return this.http.get<{
      success: boolean;
      data: {
        histories: any[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
        }
      }
    }>(`${this.API_URL}${getSpeakerByIdApi}${speakerId}/history?limit=${limit}&page=${page}`, this.getHttpOptions())
    .pipe(
      map(response => {
        if (!response.success || !response.data) {
          throw new Error('Error al obtener el historial del parlante');
        }

        // 🔥 SOLO UN LOG DE RESUMEN
        const totalHistories = response.data.histories.length;
        if (totalHistories > 0) {
          console.log(`📊 Historial parlante ${speakerId}: ${totalHistories} registros`);
        }

        return {
          data: {
            histories: response.data.histories.map(item => this.transformHistoryItem(item)),
            total: response.data.pagination.total,
            page: response.data.pagination.page,
            limit: response.data.pagination.limit
          }
        };
      })
    );
  }

  // 🔐 MÉTODOS CON AUTENTICACIÓN - SIN LOGS EXCESIVOS
  getAllSpeakers(): Observable<any> {
    return this.http.get(`${this.API_URL}${getSpeakersApi}`, this.getHttpOptions());
  }

  getSpeakerById(id: number): Observable<any> {
    return this.http.get(`${this.API_URL}${getSpeakerByIdApi}${id}`, this.getHttpOptions());
  }

  // 🔐 CREATE SPEAKER - CON AUTENTICACIÓN
  createSpeaker(speaker: any): Observable<any> {
    return this.http.post(`${this.API_URL}${createSpeakerApi}`, speaker, this.getHttpOptions());
  }

  // 🔐 UPDATE SPEAKER - CON AUTENTICACIÓN
  updateSpeaker(id: number, speaker: any): Observable<any> {
    return this.http.put(`${this.API_URL}${updateSpeakerApi}${id}`, speaker, this.getHttpOptions());
  }

  // 🔐 DELETE SPEAKER - CON AUTENTICACIÓN
  deleteSpeaker(id: number): Observable<any> {
    return this.http.delete(`${this.API_URL}${deleteSpeakerApi}${id}`, this.getHttpOptions());
  }

  // 🔐 MÉTODOS ADICIONALES CON AUTENTICACIÓN
  getSpeakerStatus(id: number): Observable<any> {
    return this.http.get(`${this.API_URL}${speakersApi}/${id}${getSpeakerStatusApi}`, this.getHttpOptions());
  }

  getSpeakerActiveSession(id: number): Observable<any> {
    return this.http.get(`${this.API_URL}${speakersApi}/${id}${getActiveSessionApi}`, this.getHttpOptions());
  }

  forceShutdownSpeaker(id: number): Observable<any> {
    return this.http.post(`${this.API_URL}${speakersApi}/${id}${forceShutdownApi}`, {}, this.getHttpOptions());
  }

  getBatteryStats(): Observable<any> {
    return this.http.get(`${this.API_URL}${speakersApi}${getBatteryLevelApi}`, this.getHttpOptions());
  }

  // 🔧 MÉTODOS DE UTILIDAD
  hasAccessToken(): boolean {
    const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
    return !!token;
  }

  clearAccessToken(): void {
    localStorage.removeItem('accessToken');
    sessionStorage.removeItem('accessToken');
  }

  // MÉTODOS DE BATERÍA
  getSpeakerBatteryLevel(speakerId: number): Observable<{
    success: boolean;
    speakerId: number;
    currentBatteryLevel: number;
    lastUpdated: string;
  }> {
    return this.http.get<any>(`${this.API_URL}${speakersApi}/${speakerId}${getBatteryLevelApi}`, this.getHttpOptions());
  }

  updateSpeakerBatteryLevel(speakerId: number, batteryLevel: number): Observable<any> {
    return this.http.put(`${this.API_URL}${speakersApi}/${speakerId}${getBatteryLevelApi}`, 
      { batteryLevel }, 
      this.getHttpOptions()
    );
  }
}