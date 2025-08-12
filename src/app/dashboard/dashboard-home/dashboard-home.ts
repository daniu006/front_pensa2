import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { AuthService } from '../../services/auth.service';
import { UserService, CreateUserRequest } from '../../services/user.service';
import { interval, Subscription, switchMap } from 'rxjs';

interface User {
  id: number;
  name: string;
  roleName: string;
}

interface EmployeeInfo {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface QRResponse {
  id: number;
  empleado_id: number;
  empleado_info: EmployeeInfo | null;
  qr_code_base64: string;
  creado_en: string;
  activo: boolean;
  total_escaneos: number;
  is_new?: boolean; // NUEVO CAMPO
}

interface AttendanceRecord {
  id: number;
  qr_id: number;
  empleado_id: number;
  empleado_info: EmployeeInfo | null;
  fecha: string;
  hora_entrada: string;
  hora_salida: string | null;
  es_entrada: boolean;
  duracion_jornada: string | null;
}

interface AttendanceStats {
  total_dias_trabajados: number;
  promedio_horas_diarias: string;
  registro_actual: AttendanceRecord | null;
  ultimo_escaneo: string | null;
}

// Interfaz para la respuesta del polling de notificaciones
interface ScanNotification {
  message: string;
  type: 'ENTRADA' | 'SALIDA';
  empleado_name: string;
  timestamp: string;
}

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, Navbar, HttpClientModule, FormsModule, RouterLink],
  providers: [UserService],
  templateUrl: './dashboard-home.html',
  styleUrls: ['./dashboard-home.css'],
})
export class DashboardHome implements OnInit, OnDestroy {
  user: User | null = null;
  qrCode: QRResponse | null = null;
  qrImageUrl: string | null = null;
  loading = false;
  error: string | null = null;
  
  attendanceRecords: AttendanceRecord[] = [];
  attendanceStats: AttendanceStats | null = null;
  loadingAttendance = false;
  attendanceError: string | null = null;
  
  private refreshSubscription: Subscription | null = null;
  autoRefresh = true;
  refreshInterval = 30000; // 30 segundos
  
  showCreateUserModal = false;
  loadingCreateUser = false;
  createUserError: string | null = null;
  
  // --- Propiedades para Notificaciones ---
  showScanNotification = false;
  notificationMessage = '';
  notificationType: 'ENTRADA' | 'SALIDA' | null = null;
  private notificationTimeout: any;
  private pollingSubscription: Subscription | null = null;

  isQRNew: boolean = false; // NUEVA PROPIEDAD
  
  newUserData = {
    name: '',
    email: '',
    password: '',
    role: 'EMPLEADO',
    isActive: true
  };
  
  private subscriptions = new Subscription();
  
  private readonly API_URL = 'https://fastapi-production-b6bb.up.railway.app';

  constructor(
    private router: Router,
    private http: HttpClient,
    private cdr: ChangeDetectorRef,
    private authService: AuthService,
    private userService: UserService
  ) {}

  ngOnInit(): void {
    this.loadUserData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.stopAutoRefresh();
    // Detener polling y timeouts para evitar fugas de memoria
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    this.subscriptions.unsubscribe();
  }
  
  isAdmin(): boolean {
    return this.user?.roleName === 'ADMIN';
  }
  
  openCreateUserModal(): void {
    if (!this.isAdmin()) {
      return;
    }

    this.newUserData = {
      name: '',
      email: '',
      password: '',
      role: 'EMPLEADO',
      isActive: true
    };
    
    this.showCreateUserModal = true;
    this.createUserError = null;
  }

  closeCreateUserModal(): void {
    this.showCreateUserModal = false;
    this.createUserError = null;
    this.loadingCreateUser = false;
  }

  createUser(): void {
    if (!this.isCreateUserFormValid()) {
      this.createUserError = 'Por favor completa todos los campos requeridos';
      return;
    }

    this.loadingCreateUser = true;
    this.createUserError = null;
    
    const userData: CreateUserRequest = {
      name: this.newUserData.name.trim(),
      email: this.newUserData.email.trim(),
      password: this.newUserData.password,
      role: this.newUserData.role,
      isActive: Boolean(this.newUserData.isActive)
    };

    this.subscriptions.add(
      this.userService.createUser(userData).subscribe({
        next: (newUser) => {
          this.closeCreateUserModal();
          this.loadingCreateUser = false;
          alert(`Usuario "${newUser.name}" creado exitosamente`);
        },
        error: (error) => {
          this.createUserError = error.message || 'Error al crear el usuario. Por favor inténtalo de nuevo.';
          this.loadingCreateUser = false;
        }
      })
    );
  }

  isCreateUserFormValid(): boolean {
    return !!(
      this.newUserData.name?.trim() &&
      this.newUserData.email?.trim() &&
      this.newUserData.password &&
      this.newUserData.role
    );
  }

  clearCreateUserError(): void {
    this.createUserError = null;
  }

  private startAutoRefresh(): void {
    if (this.autoRefresh) {
      this.refreshSubscription = interval(this.refreshInterval).subscribe(() => {
        if (this.user?.id) {
          this.loadAttendanceRecords(false);
        }
      });
    }
  }

  private stopAutoRefresh(): void {
    if (this.refreshSubscription) {
      this.refreshSubscription.unsubscribe();
      this.refreshSubscription = null;
    }
  }

  toggleAutoRefresh(): void {
    this.autoRefresh = !this.autoRefresh;
    if (this.autoRefresh) {
      this.startAutoRefresh();
    } else {
      this.stopAutoRefresh();
    }
  }

  private loadUserData(): void {
    const userSession = localStorage.getItem('userSession');
    
    if (userSession) {
      try {
        const sessionData = JSON.parse(userSession);
        this.user = {
          id: sessionData.userId || sessionData.id,
          name: sessionData.name || sessionData.username,
          roleName: sessionData.roleName || sessionData.role
        };
        
        this.loadUserQR();
        this.loadAttendanceRecords();
        
        // Iniciar el polling solo si el usuario es Administrador
        if (this.isAdmin()) {
          this.startPollingForScans();
        }
        
      } catch (e) {
        this.handleAuthError();
      }
    } else {
      this.handleAuthError();
    }
  }
  
  // Nuevo método para iniciar el polling
  private startPollingForScans(): void {
    if (!this.user?.id) return;

    // Detener cualquier polling anterior para evitar duplicados
    if (this.pollingSubscription) {
      this.pollingSubscription.unsubscribe();
    }
    
    this.pollingSubscription = interval(5000) // Preguntar cada 5 segundos
      .pipe(
        switchMap(() => 
          this.http.get<ScanNotification | null>(`${this.API_URL}/events/last-scan/${this.user!.id}`)
        )
      )
      .subscribe({
        next: (notification) => {
          // Si la respuesta no es nula, significa que hay una nueva notificación
          if (notification) {
            console.log('Notificación recibida:', notification);
            this.showNotification(notification.message, notification.type);
            // Refrescar los datos para que el dashboard esté actualizado
            this.refreshAttendance();
          }
        },
        error: (err) => {
          console.error('Error durante el polling:', err);
        }
      });
  }
  
  // Nuevo método para mostrar la notificación en la UI
  private showNotification(message: string, type: 'ENTRADA' | 'SALIDA'): void {
    this.notificationMessage = message;
    this.notificationType = type;
    this.showScanNotification = true;
    this.cdr.detectChanges(); // Forzar la actualización de la vista

    // Ocultar la notificación después de 5 segundos
    if (this.notificationTimeout) {
      clearTimeout(this.notificationTimeout);
    }
    this.notificationTimeout = setTimeout(() => {
      this.showScanNotification = false;
      this.cdr.detectChanges();
    }, 5000);
  }

  private async loadUserQR(): Promise<void> {
    if (!this.user?.id) return;

    this.loading = true;
    this.error = null;
    this.qrImageUrl = null;
    this.isQRNew = false; // Reset del indicador

    try {
      const response = await this.http.get<QRResponse>(`${this.API_URL}/employees/${this.user.id}/qr`).toPromise();

      if (response) {
        this.qrCode = response;
        this.isQRNew = response.is_new || false; // DETECTAR SI ES NUEVO
        this.convertBase64ToImageUrl(response.qr_code_base64);
        this.error = null;

        // Si el QR es nuevo, mostrar notificación temporal
        if (this.isQRNew) {
          console.log('🆕 QR Code recién generado detectado');
          this.showQRNewNotification();
        }
      } else {
        await this.generateQR();
      }

    } catch (error: any) {
      if (error.status === 404) {
        await this.generateQR();
      } else {
        this.handleQRError(error);
      }
    } finally {
      this.loading = false;
    }
  }

  // NUEVO MÉTODO: Mostrar notificación de QR nuevo
  private showQRNewNotification(): void {
    // Puedes usar tu sistema de notificaciones existente
    // o mostrar un mensaje simple
    if (this.isQRNew) {
      setTimeout(() => {
        console.log('📱 Tu código QR ha sido regenerado con éxito');
        // Opcional: mostrar una notificación visual
        this.isQRNew = false; // Quitar el indicador después de unos segundos
      }, 3000);
    }
  }

  private async generateQR(): Promise<void> {
    if (!this.user?.id) {
      this.error = 'No se pudo identificar el usuario';
      return;
    }

    try {
      const requestBody = { empleado_id: this.user.id };
      const response = await this.http.post<QRResponse>(`${this.API_URL}/qr/generate`, requestBody).toPromise();

      if (response) {
        this.qrCode = response;
        this.convertBase64ToImageUrl(response.qr_code_base64);
        this.error = null;
      } else {
        throw new Error('Respuesta vacía del servidor');
      }
    } catch (error: any) {
      this.handleQRError(error);
    }
  }

  private async loadAttendanceRecords(showLoading: boolean = true): Promise<void> {
    if (!this.user?.id) return;

    if (showLoading) this.loadingAttendance = true;
    this.attendanceError = null;

    try {
      const response = await this.http.get<AttendanceRecord[]>(`${this.API_URL}/admin/empleado/${this.user.id}/escaneos`).toPromise();

      if (response) {
        this.attendanceRecords = response;
        this.calculateAttendanceStats();
      } else {
        this.attendanceRecords = [];
        this.attendanceStats = null;
      }

    } catch (error: any) {
      this.attendanceError = this.getErrorMessage(error);
    } finally {
      if (showLoading) this.loadingAttendance = false;
      this.cdr.detectChanges();
    }
  }

  private calculateAttendanceStats(): void {
    if (!this.attendanceRecords.length) {
      this.attendanceStats = null;
      return;
    }

    const completedDays = this.attendanceRecords.filter(r => r.duracion_jornada).length;
    const totalHours = this.attendanceRecords
      .filter(r => r.duracion_jornada)
      .reduce((total, record) => total + this.parseDuration(record.duracion_jornada!), 0);

    const averageHours = completedDays > 0 ? totalHours / completedDays : 0;
    const currentRecord = this.attendanceRecords.find(r => !r.hora_salida) || null;
    const lastRecord = this.attendanceRecords[0];
    const lastScan = lastRecord ? (lastRecord.hora_salida || lastRecord.hora_entrada) : null;

    this.attendanceStats = {
      total_dias_trabajados: completedDays,
      promedio_horas_diarias: this.formatDuration(averageHours),
      registro_actual: currentRecord,
      ultimo_escaneo: lastScan
    };
  }

  private parseDuration(duration: string): number {
    const match = duration.match(/(\d+)h\s*(\d+)m/);
    return match ? parseInt(match[1]) + parseInt(match[2]) / 60 : 0;
  }

  private formatDuration(hours: number): string {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  }

  getCurrentWorkingTime(): string | null {
    if (!this.attendanceStats?.registro_actual) return null;
    const entrada = new Date(this.attendanceStats.registro_actual.hora_entrada);
    const ahora = new Date();
    const diffMs = ahora.getTime() - entrada.getTime();
    return this.formatDuration(diffMs / (1000 * 60 * 60));
  }

  getStatusBadgeClass(): string {
    return this.attendanceStats?.registro_actual ? 'status-in' : 'status-out';
  }

  getStatusText(): string {
    return this.attendanceStats?.registro_actual ? 'En el trabajo' : 'Fuera del trabajo';
  }
  
  formatTime(dateTimeStr: string | null): string {
    if (!dateTimeStr) return 'N/A';
    return new Date(dateTimeStr).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('es-ES', { weekday: 'long', day: '2-digit', month: '2-digit' });
  }

  async refreshAttendance(): Promise<void> {
    await this.loadAttendanceRecords();
  }

  private convertBase64ToImageUrl(base64String: string): void {
    if (!base64String) {
      this.qrImageUrl = null;
      return;
    }
    this.qrImageUrl = `data:image/png;base64,${base64String}`;
  }

  private handleQRError(error: any): void {
    this.error = this.getErrorMessage(error);
  }

  private getErrorMessage(error: any): string {
    if (error.status === 0) return 'No se puede conectar al servidor.';
    return error.error?.detail || error.message || 'Error desconocido.';
  }

  async refreshQR(): Promise<void> {
    await this.loadUserQR();
  }


  getQRImageUrl(): string | null {
    return this.qrImageUrl;
  }

  canShowQR(): boolean {
    return !!(this.qrCode && this.qrImageUrl && !this.loading && !this.error);
  }

  private handleAuthError(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}