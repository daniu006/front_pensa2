import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';
import { switchMap, catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { apiURL } from '../../services/api';
import { 
  endSessionApi, 
  esp32Data, 
  getActiveSpeakerSessionApi, 
  setVolumeApi, 
  speakersApi, 
  startSessionApi 
} from '../../constants/endPoints';
import { AuthService } from '../../services/auth.service';
import { RealtimeSessionData, SessionData, SpeakerInfo } from '../../interfaces/controlPanel';


@Component({
  selector: 'app-control-panel',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, HttpClientModule],
  templateUrl: './control-panel.html',
  styleUrls: ['./control-panel.css']
})
export class ControlPanelComponent implements OnInit, OnDestroy {
  
  // ===== INYECCIÓN DE DEPENDENCIAS =====
  private http = inject(HttpClient);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private authService = inject(AuthService);

  // ===== CONFIGURACIÓN =====
  private readonly ESP32_API_URL = `${apiURL}${esp32Data}`;
  private readonly SPEAKERS_API_URL = `${apiURL}${speakersApi}`;
  private readonly POLLING_INTERVAL = 2000; // 2 segundos
  private readonly userId = 1;

  // ===== ESTADO PRINCIPAL =====
  speakerId!: number;
  isLoading = true;
  isConnected = false;
  // REMOVED: showEnergy property (no longer needed since it's always visible)
  errorMessage: string | null = null;
  activeSessionId: number | null = null;
  
  // ===== DATOS =====
  speakerInfo: SpeakerInfo = { name: 'Cargando...', position: 'Cargando...' };
  realtimeData: RealtimeSessionData | null = null;
  sessionStartTime: string | null = null;
  sessionDuration = '00:00:00';
  
  // ===== CONTROL DE VOLUMEN =====
  currentVolume = 25;
  minVolume = 5;
  maxVolume = 30;
  volumeStatus: 'idle' | 'updating' | 'error' = 'idle';
  lastVolumeUpdate: Date | null = null;
  
  // ===== SUBSCRIPCIONES =====
  private pollingSubscription?: Subscription;
  
  // ===== PROPIEDADES COMPUTADAS =====
  username$ = this.authService.currentUser$;

  // ===== LIFECYCLE HOOKS =====
  ngOnInit(): void {
    this.initializeComponent();
  }

  ngOnDestroy(): void {
    this.stopPolling();
  }

  // ===== INICIALIZACIÓN =====
  private initializeComponent(): void {
    const id = this.route.snapshot.paramMap.get('id');
    
    if (!id || isNaN(Number(id)) || Number(id) < 1) {
      this.errorMessage = `ID de parlante inválido: ${id || 'null'}`;
      this.isLoading = false;
      return;
    }
    
    this.speakerId = Number(id);
    this.checkInitialStatus();
  }

  // ===== VERIFICACIÓN DE ESTADO =====
  private checkInitialStatus(): void {
    this.isLoading = true;
    console.log('🔍 Verificando estado inicial para speaker:', this.speakerId);
    
    this.http.get<{ 
      success: boolean; 
      hasActiveSession: boolean; 
      session: SessionData | null;
    }>(`${this.ESP32_API_URL}${getActiveSpeakerSessionApi}${this.speakerId}`)
      .pipe(
        catchError(err => {
          console.error('❌ Error checking status:', err);
          return of({ success: false, hasActiveSession: false, session: null });
        })
      )
      .subscribe({
        next: (response) => {
          this.handleInitialStatusResponse(response);
        },
        error: (err) => {
          this.handleError('Error al verificar el estado del parlante', err);
        }
      });
  }

  private handleInitialStatusResponse(response: any): void {
    if (response.success && response.hasActiveSession && response.session) {
      this.setupActiveSession(response.session);
    } else {
      this.isConnected = false;
      this.getSpeakerDetails();
    }
    this.isLoading = false;
  }

  private setupActiveSession(session: SessionData): void {
    this.isConnected = true;
    this.activeSessionId = session.id;
    this.speakerInfo.name = session.speaker?.name || 'Desconocido';
    this.speakerInfo.position = session.speaker?.position || 'Desconocida';
    this.sessionStartTime = session.startTime;
    
    console.log(`✅ Sesión activa encontrada (ID: ${this.activeSessionId})`);
    this.startOptimizedPolling(this.activeSessionId);
  }

  private getSpeakerDetails(): void {
    this.http.get<{ 
      success: boolean; 
      data: SpeakerInfo;
    }>(`${this.SPEAKERS_API_URL}/${this.speakerId}`)
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.speakerInfo = res.data;
          }
        },
        error: (err) => {
          console.error('❌ Error obteniendo detalles del parlante:', err);
          this.speakerInfo = { name: 'Desconocido', position: 'Desconocida' };
        }
      });
  }

  // ===== CONTROL DE SESIÓN =====
  toggleStatus(): void {
    if (this.isConnected) {
      this.turnOffSpeaker();
    } else {
      this.turnOnSpeaker();
    }
  }

  private turnOnSpeaker(): void {
    
    const payload = {
      speakerId: this.speakerId,
      userId: this.userId,
      initialBatteryPercentage: 100,
      mode: "ultra_optimized",
      initialVolume: this.currentVolume
    };

    this.http.post<{ 
      success: boolean; 
      data: { id: number; startTime: string };
      message: string;
    }>(`${this.ESP32_API_URL}${startSessionApi}`, payload)
      .subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.handleSuccessfulStart(response.data);
          }
        },
        error: (err) => {
          this.handleError('No se pudo encender el parlante', err);
        }
      });
  }

  private handleSuccessfulStart(data: { id: number; startTime: string }): void {
    this.isConnected = true;
    this.activeSessionId = data.id;
    this.errorMessage = null;
    this.sessionStartTime = data.startTime;
    this.resetData();
    this.startOptimizedPolling(this.activeSessionId);
    
  }

  private turnOffSpeaker(): void {
    if (!this.activeSessionId || !this.realtimeData) return;

    console.log('🔇 Finalizando sesión y guardando historial');

    const payload = this.createEndSessionPayload();

    this.http.post<{ 
      success: boolean; 
      data: any;
      message: string;
    }>(`${this.ESP32_API_URL}${endSessionApi}${this.activeSessionId}`, payload)
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.handleSuccessfulEnd();
          }
        },
        error: (err) => {
          this.handleError('No se pudo apagar el parlante', err);
          this.isConnected = true; // Revertir estado
        }
      });
  }

  private createEndSessionPayload() {
  if (!this.realtimeData) throw new Error('No realtime data available');
  
  const payload = {
    finalBatteryPercentage: this.realtimeData.latestData.battery_remaining_percent,
    totalMeasurementsSent: this.realtimeData.statistics.measurementCount,
    totalConsumed_mAh: this.realtimeData.statistics.totalConsumed_mAh,  // ← Campo clave
    sessionDurationSeconds: this.realtimeData.statistics.durationSeconds,
    avgCurrent_mA: this.realtimeData.statistics.avgCurrent_mA,
    avgVoltage_V: this.realtimeData.statistics.avgVoltage_V,
    avgPower_mW: this.realtimeData.statistics.avgPower_mW,
    peakPower_mW: this.realtimeData.statistics.peakPower_mW,
    mode: "ultra_optimized"
  };

  // ✅ LOGGING PARA DEBUG DEL PROBLEMA
  console.log('🔍 DEBUG - Payload para finalizar sesión:', payload);
  console.log('🔍 DEBUG - Datos completos de realtimeData.statistics:', this.realtimeData.statistics);
  console.log('🔍 DEBUG - Datos completos de realtimeData.latestData:', this.realtimeData.latestData);
  
  // ✅ VERIFICAR SI EL CAMPO CLAVE ESTÁ PRESENTE
  if (!payload.totalConsumed_mAh || payload.totalConsumed_mAh <= 0) {
    console.warn('⚠️ totalConsumed_mAh está vacío o en cero:', {
      fromStatistics: this.realtimeData.statistics.totalConsumed_mAh,
      fromLatestData: this.realtimeData.latestData.total_consumed_mAh,
      allStatistics: this.realtimeData.statistics,
      allLatestData: this.realtimeData.latestData
    });
    
    // Intentar usar el valor del latestData si statistics está vacío
    if (this.realtimeData.latestData.total_consumed_mAh > 0) {
      console.log('🔄 Usando totalConsumed_mAh desde latestData:', this.realtimeData.latestData.total_consumed_mAh);
      payload.totalConsumed_mAh = this.realtimeData.latestData.total_consumed_mAh;
    }
  }

  return payload;
}

  private handleSuccessfulEnd(): void {
    this.isConnected = false;
    this.activeSessionId = null;
    this.errorMessage = null;
    this.resetData();
    this.stopPolling();
    console.log('✅ Sesión finalizada - Historial guardado');
  }

  // ===== POLLING OPTIMIZADO =====
  private startOptimizedPolling(sessionId: number): void {
    this.stopPolling();
    
    
    this.pollingSubscription = timer(500, this.POLLING_INTERVAL).pipe(
      switchMap(() => this.http.get<{ 
        success: boolean; 
        data: RealtimeSessionData;
      }>(`${this.ESP32_API_URL}/realtime-data/${sessionId}`)),
      catchError(err => {
        console.error('❌ Error en fetching:', err);
        return of(null);
      })
    ).subscribe({
      next: (response) => {
        this.handlePollingResponse(response);
      },
      error: (err) => {
        console.error('❌ Error durante polling:', err);
        this.errorMessage = 'Se perdió la conexión. Reintentando...';
      }
    });
  }

  private handlePollingResponse(response: any): void {
    if (response?.success && response.data) {
      this.errorMessage = null;
      this.realtimeData = response.data;
      this.updateSessionDuration();
      this.animateDataUpdate();
    }
  }

  private stopPolling(): void {
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
      this.pollingSubscription = undefined;
      console.log('⏹️ Polling detenido');
    }
  }

  // ===== CONTROL DE VOLUMEN =====
  onVolumeChange(event: any): void {
    const volume = parseInt(event.target.value);
    if (volume >= this.minVolume && volume <= this.maxVolume) {
      this.setVolume(volume);
    }
  }

  increaseVolume(): void {
    if (this.currentVolume < this.maxVolume) {
      this.setVolume(this.currentVolume + 1);
    }
  }

  decreaseVolume(): void {
    if (this.currentVolume > this.minVolume) {
      this.setVolume(this.currentVolume - 1);
    }
  }

  setVolumePreset(volume: number): void {
    this.setVolume(volume);
  }

  private setVolume(volume: number): void {
    if (!this.validateVolumeRequest(volume)) return;

    this.volumeStatus = 'updating';
    const previousVolume = this.currentVolume;
    this.currentVolume = volume;

    const payload = {
      volume: volume,
      speakerId: this.speakerId,
      sessionId: this.activeSessionId,
      timestamp: new Date().toISOString()
    };

    this.http.post<{ success: boolean; message?: string; }>
      (`${this.ESP32_API_URL}${setVolumeApi}${this.speakerId}`, payload)
      .subscribe({
        next: (response) => {
          this.handleVolumeResponse(response, volume);
        },
        error: (err) => {
          this.handleVolumeError(err, previousVolume);
        }
      });
  }

  private validateVolumeRequest(volume: number): boolean {
    if (!this.isConnected || !this.activeSessionId) {
      this.showTemporaryError('No se puede ajustar el volumen sin sesión activa');
      return false;
    }

    if (volume < this.minVolume || volume > this.maxVolume) {
      console.error(`❌ Volumen fuera de rango: ${volume}`);
      return false;
    }

    return true;
  }

  private handleVolumeResponse(response: any, volume: number): void {
    if (response.success) {
      this.volumeStatus = 'idle';
      this.lastVolumeUpdate = new Date();
      console.log(`✅ Volumen ajustado a ${volume}/30`);
    } else {
      this.volumeStatus = 'error';
      this.showTemporaryError(response.message || 'Error al ajustar el volumen');
    }
  }

  private handleVolumeError(err: any, previousVolume: number): void {
    console.error('❌ Error enviando comando de volumen:', err);
    this.volumeStatus = 'error';
    this.currentVolume = previousVolume;
    this.showTemporaryError('Error al ajustar el volumen. Verifica la conexión.');
  }

  // ===== GUARDADO DE SESIÓN =====
  saveSessionData(): void {
    if (!this.canSaveSession()) {
      this.errorMessage = 'No hay datos suficientes para guardar la sesión.';
      return;
    }

    console.log('💾 Guardando sesión ');

    const payload = this.createEndSessionPayload();

    this.http.post<{ 
      success: boolean; 
      data: any; 
      message?: string;
    }>(`${this.ESP32_API_URL}${endSessionApi}${this.activeSessionId}`, payload)
      .subscribe({
        next: (response) => {
          this.handleSaveResponse(response);
        },
        error: (err) => {
          this.handleError('No se pudieron guardar los datos de la sesión', err);
        }
      });
  }

  private handleSaveResponse(response: any): void {
    if (response.success) {
      this.handleSuccessfulSave();
    } else {
      this.errorMessage = response.message || 'Error desconocido al guardar';
    }
  }

  private handleSuccessfulSave(): void {
    const stats = this.generateSaveStats();
    
    this.isConnected = false;
    this.activeSessionId = null;
    this.errorMessage = null;
    this.resetData();
    this.stopPolling();
    
    alert(`✅ Sesión guardada exitosamente\n\n${stats}`);
    this.router.navigate(['/dashboard/select-panel']);
  }

  private generateSaveStats(): string {
    if (!this.realtimeData) return '';
    
    const measurements = this.realtimeData.statistics.measurementCount;
    const consumed = this.realtimeData.statistics.totalConsumed_mAh.toFixed(1);
    const duration = Math.floor(this.realtimeData.statistics.durationSeconds / 60);
    
    return `📊 Estadísticas:\n• ${measurements} mediciones\n• ${consumed} mAh consumidos\n• ${duration} minutos`;
  }

  // ===== MÉTODOS DE UTILIDAD =====
  private updateSessionDuration(): void {
    if (!this.sessionStartTime) return;

    const start = new Date(this.sessionStartTime);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
    
    this.sessionDuration = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  private resetData(): void {
    this.realtimeData = null;
    this.sessionDuration = '00:00:00';
    this.volumeStatus = 'idle';
    this.lastVolumeUpdate = null;
  }

  private animateDataUpdate(): void {
    if (!this.realtimeData?.hasRealtimeData) return;
    
    // Animar tarjetas de métricas
    const metricCards = document.querySelectorAll('.metric-card');
    metricCards.forEach(card => {
      card.classList.add('updated');
      setTimeout(() => card.classList.remove('updated'), 600);
    });
  }

  private handleError(message: string, error: any): void {
    console.error(`❌ ${message}:`, error);
    this.errorMessage = error.error?.message || message;
    this.isLoading = false;
  }

  private showTemporaryError(message: string): void {
    this.errorMessage = message;
    setTimeout(() => {
      if (this.errorMessage === message) {
        this.errorMessage = null;
      }
    }, 3000);
  }

  // ===== MÉTODOS PARA EL TEMPLATE =====
  // REMOVED: toggleEnergy() method (no longer needed since Energy Metrics is always visible)

  canSaveSession(): boolean {
    return !!(this.activeSessionId && this.realtimeData && this.hasRealtimeData());
  }

  hasRealtimeData(): boolean {
    return this.realtimeData?.hasRealtimeData || false;
  }

  getConnectionStatus(): string {
    if (!this.isConnected) return 'Desconectado';
    if (!this.realtimeData) return 'Conectado - Sin datos';
    if (!this.realtimeData.hasRealtimeData) return 'Conectado - Esperando datos';
    return 'Conectado - Datos en tiempo real';
  }

  getDataFreshness(): string {
    if (!this.realtimeData?.lastUpdated) return 'Sin datos';
    
    const lastUpdate = new Date(this.realtimeData.lastUpdated);
    const now = new Date();
    const diffSeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
    
    if (diffSeconds < 5) return 'Datos frescos';
    if (diffSeconds < 10) return 'Datos recientes';
    if (diffSeconds < 30) return 'Datos antiguos';
    return 'Datos obsoletos';
  }

  // ===== GETTERS PARA MÉTRICAS =====
  getMeasurementCount(): number {
    return this.realtimeData?.statistics.measurementCount || 0;
  }

  getLatestVoltage(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.00';
    return this.realtimeData.latestData.voltage_V.toFixed(2);
  }

  getLatestCurrent(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.0';
    return this.realtimeData.latestData.current_mA.toFixed(1);
  }

  getLatestPower(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.0';
    return this.realtimeData.latestData.power_mW.toFixed(1);
  }

  getLatestBattery(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.0';
    return this.realtimeData.latestData.battery_remaining_percent.toFixed(1);
  }

  getTotalConsumed(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.0';
    return this.realtimeData.latestData.total_consumed_mAh.toFixed(1);
  }

  getAverageVoltage(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.00';
    return this.realtimeData.statistics.avgVoltage_V.toFixed(2);
  }

  getAverageCurrent(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.0';
    return this.realtimeData.statistics.avgCurrent_mA.toFixed(1);
  }

  getAveragePower(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.0';
    return this.realtimeData.statistics.avgPower_mW.toFixed(1);
  }

  getPeakPower(): string {
    if (!this.realtimeData?.hasRealtimeData) return '0.0';
    return this.realtimeData.statistics.peakPower_mW.toFixed(1);
  }

  getCurrentSampleIndex(): number {
    return this.realtimeData?.latestData.sample_index || 0;
  }

  getTimestamp(): number {
    return this.realtimeData?.latestData.timestamp || 0;
  }

  getDurationSeconds(): number {
    return this.realtimeData?.statistics.durationSeconds || 0;
  }

  // ===== GETTERS PARA BATERÍA =====
  getBatteryStatus(): string {
    if (!this.realtimeData?.hasRealtimeData) return 'Desconocido';
    
    const battery = this.realtimeData.latestData.battery_remaining_percent;
    if (battery > 80) return 'Excelente';
    if (battery > 60) return 'Bueno';
    if (battery > 40) return 'Aceptable';
    if (battery > 20) return 'Bajo';
    if (battery > 10) return 'Crítico';
    return 'Muy Crítico';
  }

  getBatteryColor(): string {
    if (!this.realtimeData?.hasRealtimeData) return '#6c757d';
    
    const battery = this.realtimeData.latestData.battery_remaining_percent;
    if (battery > 60) return 'linear-gradient(135deg, #28a745, #20c997)';
    if (battery > 40) return 'linear-gradient(135deg, #28a745, #ffc107)';
    if (battery > 20) return 'linear-gradient(135deg, #ffc107, #fd7e14)';
    if (battery > 10) return 'linear-gradient(135deg, #fd7e14, #dc3545)';
    return 'linear-gradient(135deg, #dc3545, #721c24)';
  }

  // ===== GETTERS PARA VOLUMEN =====
  getVolumePercent(): number {
    return Math.round((this.currentVolume / this.maxVolume) * 100);
  }

  getVolumeStatusText(): string {
    switch (this.volumeStatus) {
      case 'updating':
        return 'Ajustando volumen...';
      case 'error':
        return 'Error al ajustar volumen';
      case 'idle':
      default:
        if (this.lastVolumeUpdate) {
          const timeDiff = Math.floor((new Date().getTime() - this.lastVolumeUpdate.getTime()) / 1000);
          if (timeDiff < 5) {
            return `Volumen ajustado hace ${timeDiff}s`;
          }
        }
        return `Nivel: ${this.getVolumeDescription()}`;
    }
  }

  private getVolumeDescription(): string {
    const percent = this.getVolumePercent();
    if (percent <= 20) return 'Muy Bajo';
    if (percent <= 40) return 'Bajo';  
    if (percent <= 60) return 'Medio';
    if (percent <= 80) return 'Alto';
    return 'Máximo';
  }

  // ===== MÉTODOS DE DEBUGGING =====
  getSystemStatus(): { [key: string]: any } {
    return {
      isConnected: this.isConnected,
      activeSessionId: this.activeSessionId,
      speakerId: this.speakerId,
      currentVolume: this.currentVolume,
      volumeStatus: this.volumeStatus,
      hasRealtimeData: this.hasRealtimeData(),
      sessionDuration: this.sessionDuration,
      measurementCount: this.getMeasurementCount(),
      batteryLevel: this.getLatestBattery(),
      connectionStatus: this.getConnectionStatus(),
      dataFreshness: this.getDataFreshness()
    };
  }

  debugSystemState(): void {
    console.log('🔍 === ESTADO COMPLETO DEL SISTEMA ===');
    console.table(this.getSystemStatus());
    
    if (this.realtimeData) {
      console.log('📊 Datos en tiempo real:', this.realtimeData);
    }
    
    
    if (this.lastVolumeUpdate) {
      console.log(`  - Última actualización: ${this.lastVolumeUpdate.toLocaleTimeString()}`);
    }
    
  }

  // ===== MÉTODO DE LIMPIEZA =====
  resetSystem(): void {
    console.log('🔄 Reiniciando sistema...');
    
    this.stopPolling();
    this.resetData();
    this.isConnected = false;
    this.activeSessionId = null;
    this.errorMessage = null;
    this.volumeStatus = 'idle';
    this.lastVolumeUpdate = null;
    
    setTimeout(() => {
      this.checkInitialStatus();
    }, 1000);
    
    console.log('✅ Sistema reiniciado');
  }

  // ===== MÉTODO DE LOGOUT =====
  handleLogout(): void {
    this.authService.logout();
  }
}