import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, Subject } from 'rxjs';
import { User, UserService } from '../../services/user.service';
import { apiURL } from '../../services/api';
import { loginApi, speakersApi } from '../../constants/endPoints';

// --- INTERFACES ACTUALIZADAS ---
interface UserAttendanceRecord {
  hora_entrada: string | null;
  hora_salida: string | null;
  duracion_jornada: string | null;
  status: 'Present' | 'Absent' | 'Completed';
}

interface UserWithAttendance {
  id: number;
  name: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  attendance_today: UserAttendanceRecord;
}

interface AttendanceReport {
  empleado_id: number;
  empleado_info: UserWithAttendance;
  total_dias: number;
  dias_presente: number;
  dias_ausente: number;
  horas_totales: string;
  promedio_horas_diarias: string;
  registros: any[];
}

interface WeeklyStats {
  week_start: string;
  week_end: string;
  total_empleados: number;
  empleados_activos: number;
  promedio_asistencia: number;
  total_horas_trabajadas: string;
}

interface MonthlyStats {
  month: string;
  year: number;
  total_empleados: number;
  empleados_activos: number;
  dias_laborales: number;
  promedio_asistencia: number;
  total_horas_trabajadas: string;
}

interface DashboardStats {
  today: any;
  this_week: any;
  this_month: any;
  last_update: string;
}

interface Speaker {
  id: number;
  name: string;
  position: string;
  state: boolean;
  batteryPercentage: number;
  createdAt: string;
  updatedAt: string;
  usageSessions: any[];
  _count: {
    usageSessions: number;
    histories: number;
  };
}

interface SpeakersApiResponse {
  success: boolean;
  count: number;
  data: Speaker[];
  timestamp: string;
}

// Enum para períodos de tiempo
enum TimePeriod {
  TODAY = 'today',
  YESTERDAY = 'yesterday',
  THIS_WEEK = 'this_week',
  LAST_WEEK = 'last_week',
  THIS_MONTH = 'this_month',
  LAST_MONTH = 'last_month',
  CUSTOM = 'custom'
}

@Component({
  selector: 'app-advanced-settings',
  standalone: true,
  imports: [CommonModule, HttpClientModule, FormsModule],
  providers: [UserService],
  templateUrl: './advanced-settings.html',
  styleUrl: './advanced-settings.css'
})
export class AdvancedSettingsComponent implements OnInit, OnDestroy {
  
  private readonly API_URL = apiURL;
  private readonly FASTAPI_URL = 'https://fastapi-production-b6bb.up.railway.app';

  // Filtros y búsqueda
  searchTerm = '';
  selectedPeriod: TimePeriod = TimePeriod.TODAY;
  selectedStatus = '';
  selectedRole = '';
  customStartDate = '';
  customEndDate = '';
  
  // Subjects para debounce en búsqueda
  private searchSubject = new Subject<string>();
  
  // Enum para el template
  TimePeriod = TimePeriod;
  
  // Vista activa
  activeView: 'dashboard' | 'detailed' | 'weekly' | 'monthly' = 'dashboard';
  
  // Datos del dashboard (actualizado)
  dashboardData = {
    stats: {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      totalSpeakers: 0,
      activeSpeakers: 0,
      inactiveSpeakers: 0,
      lastUpdate: new Date()
    },
    allUsers: [] as UserWithAttendance[],
    filteredUsers: [] as UserWithAttendance[],
    recentSpeakers: [] as Speaker[]
  };

  // Datos adicionales
  attendanceStats: DashboardStats | null = null;
  weeklyStats: WeeklyStats[] = [];
  monthlyStats: MonthlyStats[] = [];
  selectedEmployeeReport: AttendanceReport | null = null;

  loading = false;
  error: string | null = null;
  currentTime = '';
  private timeInterval: any;
  private subscription = new Subscription();

  // Opciones para los filtros
  periodOptions = [
    { value: TimePeriod.TODAY, label: 'Hoy' },
    { value: TimePeriod.YESTERDAY, label: 'Ayer' },
    { value: TimePeriod.THIS_WEEK, label: 'Esta Semana' },
    { value: TimePeriod.LAST_WEEK, label: 'Semana Pasada' },
    { value: TimePeriod.THIS_MONTH, label: 'Este Mes' },
    { value: TimePeriod.LAST_MONTH, label: 'Mes Pasado' },
    { value: TimePeriod.CUSTOM, label: 'Período Personalizado' }
  ];

  statusOptions = [
    { value: '', label: 'Todos los Estados' },
    { value: 'Present', label: 'Presente' },
    { value: 'Completed', label: 'Completado' },
    { value: 'Absent', label: 'Ausente' }
  ];

  roleOptions = [
    { value: '', label: 'Todos los Roles' },
    { value: 'ADMIN', label: 'Administrador' },
    { value: 'USER', label: 'Usuario' },
    { value: 'SUPERADMIN', label: 'Super Admin' }
  ];

  constructor(
    private router: Router,
    private location: Location,
    private userService: UserService,
    private http: HttpClient
  ) {
    this.router.onSameUrlNavigation = 'reload';
  }

  ngOnInit() {
    // Inicializar la fecha y hora
    this.updateCurrentTime();
    
    // Actualizar cada segundo
    this.timeInterval = setInterval(() => {
      this.updateCurrentTime();
    }, 1000);

    // Configurar búsqueda con debounce
    this.subscription.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(searchTerm => {
        this.performSearch();
      })
    );

    // Cargar datos iniciales
    this.loadDashboardData();
  }

  ngOnDestroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
    this.subscription.unsubscribe();
  }

  // ==================== MÉTODOS DE CARGA DE DATOS ====================

  loadDashboardData() {
    this.loading = true;
    this.error = null;
    
    console.log('🔄 Loading dashboard data...');
    
    // Cargar datos según la vista activa
    switch (this.activeView) {
      case 'dashboard':
        this.loadAttendanceStats();
        this.loadUsersWithSearch();
        break;
      case 'weekly':
        this.loadWeeklyStats();
        break;
      case 'monthly':
        this.loadMonthlyStats();
        break;
      case 'detailed':
        this.loadUsersWithSearch();
        break;
    }
    
    // Siempre cargar speakers para el dashboard general
    this.loadSpeakersData();
  }

  private loadAttendanceStats() {
    console.log('📊 Loading attendance dashboard stats...');
    const statsUrl = `${this.FASTAPI_URL}/attendance/dashboard-stats`;
    
    this.subscription.add(
      this.http.get<DashboardStats>(statsUrl).subscribe({
        next: (stats) => {
          console.log('✅ Attendance stats loaded:', stats);
          this.attendanceStats = stats;
        },
        error: (error) => {
          console.error('❌ Error loading attendance stats:', error);
          this.error = 'Failed to load attendance statistics.';
        }
      })
    );
  }

  private loadUsersWithSearch() {
    console.log('🔍 Loading users with search filters...');
    
    const params = new URLSearchParams();
    
    if (this.searchTerm.trim()) {
      params.append('search', this.searchTerm.trim());
    }
    
    if (this.selectedPeriod) {
      params.append('period', this.selectedPeriod);
    }
    
    if (this.selectedStatus) {
      params.append('status', this.selectedStatus);
    }
    
    if (this.selectedRole) {
      params.append('role', this.selectedRole);
    }
    
    if (this.selectedPeriod === TimePeriod.CUSTOM) {
      if (this.customStartDate) {
        params.append('start_date', this.customStartDate);
      }
      if (this.customEndDate) {
        params.append('end_date', this.customEndDate);
      }
    }
    
    const searchUrl = `${this.FASTAPI_URL}/attendance/search?${params.toString()}`;
    
    this.subscription.add(
      this.http.get<UserWithAttendance[]>(searchUrl).subscribe({
        next: (users) => {
          console.log('✅ Users with filters loaded:', users.length, 'users');
          this.dashboardData.filteredUsers = users;
          this.updateUserStats(users);
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading users:', error);
          this.error = 'Failed to load user data. Please try again.';
          this.dashboardData.filteredUsers = [];
          this.loading = false;
        }
      })
    );
  }

  private loadWeeklyStats() {
    console.log('📅 Loading weekly stats...');
    const weeklyUrl = `${this.FASTAPI_URL}/attendance/weekly-stats?weeks_back=8`;
    
    this.subscription.add(
      this.http.get<WeeklyStats[]>(weeklyUrl).subscribe({
        next: (stats) => {
          console.log('✅ Weekly stats loaded:', stats);
          this.weeklyStats = stats;
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading weekly stats:', error);
          this.error = 'Failed to load weekly statistics.';
          this.loading = false;
        }
      })
    );
  }

  private loadMonthlyStats() {
    console.log('📅 Loading monthly stats...');
    const monthlyUrl = `${this.FASTAPI_URL}/attendance/monthly-stats?months_back=6`;
    
    this.subscription.add(
      this.http.get<MonthlyStats[]>(monthlyUrl).subscribe({
        next: (stats) => {
          console.log('✅ Monthly stats loaded:', stats);
          this.monthlyStats = stats;
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading monthly stats:', error);
          this.error = 'Failed to load monthly statistics.';
          this.loading = false;
        }
      })
    );
  }

  private loadSpeakersData() {
    console.log('🔄 Loading speakers data...');
    
    this.subscription.add(
      this.http.get<SpeakersApiResponse>(`${this.API_URL}${speakersApi}`).subscribe({
        next: (response) => {
          console.log('✅ Speakers loaded successfully:', response);
          
          if (response.success && response.data) {
            this.updateSpeakerStats(response.data);
          } else {
            console.warn('⚠️ Invalid speakers response format');
            this.setDefaultSpeakerStats();
          }
        },
        error: (error) => {
          console.error('❌ Error loading speakers:', error);
          this.setDefaultSpeakerStats();
        }
      })
    );
  }

  // ==================== MÉTODOS DE BÚSQUEDA Y FILTROS ====================

  onSearchChange(event: any) {
    this.searchTerm = event.target.value;
    this.searchSubject.next(this.searchTerm);
  }

  onPeriodChange(period: TimePeriod) {
    this.selectedPeriod = period;
    this.performSearch();
  }

  onStatusChange(status: string) {
    this.selectedStatus = status;
    this.performSearch();
  }

  onRoleChange(role: string) {
    this.selectedRole = role;
    this.performSearch();
  }

  onCustomDateChange() {
    if (this.selectedPeriod === TimePeriod.CUSTOM) {
      this.performSearch();
    }
  }

  private performSearch() {
    console.log('🔍 Performing search with filters:', {
      search: this.searchTerm,
      period: this.selectedPeriod,
      status: this.selectedStatus,
      role: this.selectedRole,
      customDates: this.selectedPeriod === TimePeriod.CUSTOM ? 
        { start: this.customStartDate, end: this.customEndDate } : null
    });
    
    this.loadUsersWithSearch();
  }

  clearFilters() {
    this.searchTerm = '';
    this.selectedPeriod = TimePeriod.TODAY;
    this.selectedStatus = '';
    this.selectedRole = '';
    this.customStartDate = '';
    this.customEndDate = '';
    this.performSearch();
  }

  // ==================== MÉTODOS DE VISTA ====================

  setActiveView(view: 'dashboard' | 'detailed' | 'weekly' | 'monthly') {
    this.activeView = view;
    this.loadDashboardData();
  }

  viewEmployeeReport(empleadoId: number) {
    console.log('📊 Loading employee report for:', empleadoId);
    
    const reportUrl = `${this.FASTAPI_URL}/attendance/report/${empleadoId}?period=${this.selectedPeriod}`;
    
    this.subscription.add(
      this.http.get<AttendanceReport>(reportUrl).subscribe({
        next: (report) => {
          console.log('✅ Employee report loaded:', report);
          this.selectedEmployeeReport = report;
        },
        error: (error) => {
          console.error('❌ Error loading employee report:', error);
          this.error = 'Failed to load employee report.';
        }
      })
    );
  }

  closeEmployeeReport() {
    this.selectedEmployeeReport = null;
  }

  // ==================== MÉTODOS DE ESTADÍSTICAS ====================

  private updateUserStats(users: UserWithAttendance[]) {
    this.dashboardData.stats.totalUsers = users.length;
    this.dashboardData.stats.activeUsers = users.filter(user => user.isActive).length;
    this.dashboardData.stats.inactiveUsers = users.length - this.dashboardData.stats.activeUsers;
    this.dashboardData.stats.lastUpdate = new Date();

    console.log('👥 User stats updated:', {
      total: this.dashboardData.stats.totalUsers,
      active: this.dashboardData.stats.activeUsers,
      inactive: this.dashboardData.stats.inactiveUsers
    });
  }

  private updateSpeakerStats(speakers: Speaker[]) {
    const activeSpeakers = speakers.filter(speaker => speaker.state).length;
    const inactiveSpeakers = speakers.filter(speaker => !speaker.state).length;

    this.dashboardData.stats.totalSpeakers = speakers.length;
    this.dashboardData.stats.activeSpeakers = activeSpeakers;
    this.dashboardData.stats.inactiveSpeakers = inactiveSpeakers;
    this.dashboardData.stats.lastUpdate = new Date();

    this.dashboardData.recentSpeakers = speakers
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    console.log('🔊 Speaker stats updated:', {
      total: this.dashboardData.stats.totalSpeakers,
      active: this.dashboardData.stats.activeSpeakers,
      inactive: this.dashboardData.stats.inactiveSpeakers
    });
  }

  private setDefaultSpeakerStats() {
    this.dashboardData.stats.totalSpeakers = 0;
    this.dashboardData.stats.activeSpeakers = 0;
    this.dashboardData.stats.inactiveSpeakers = 0;
    this.dashboardData.recentSpeakers = [];
    
    console.log('⚠️ Using default speaker stats due to error');
  }

  // ==================== MÉTODOS UTILITARIOS ====================

  private updateCurrentTime() {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    };
    
    this.currentTime = now.toLocaleDateString('en-US', options);
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  refreshData() {
    console.log('🔄 Refreshing dashboard data...');
    this.loadDashboardData();
  }

  onLogout(): void {
    if (typeof window !== 'undefined') {
      localStorage.clear();
    }
    this.router.navigate(['/auth/login']);
  }

  logout() {
    const confirmLogout = confirm('¿Estás seguro de que quieres desconectarte?');
    
    if (confirmLogout) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      localStorage.removeItem('roleName');
      localStorage.removeItem('userSession');
      
      if (this.timeInterval) {
        clearInterval(this.timeInterval);
      }
      
      this.router.navigate([`${loginApi}`]).then(() => {
        console.log('Logged out successfully');
      });
    }
  }

  // ==================== MÉTODOS DE FORMATO ====================

  getUserAvatar(user: UserWithAttendance): string {
    return (user.firstName || user.name).charAt(0).toUpperCase();
  }

  formatCreatedDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return 'Today';
    } else if (diffDays === 2) {
      return 'Yesterday';
    } else if (diffDays <= 7) {
      return `${diffDays - 1} days ago`;
    } else {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });
    }
  }

  getUserRole(user: UserWithAttendance): string {
    switch (user.role) {
      case 'SUPERADMIN':
        return 'Super Admin';
      case 'ADMIN':
        return 'Administrator';
      case 'USER':
        return 'User';
      default:
        return user.role;
    }
  }

  getAttendanceStatusClass(status: string): string {
    switch (status) {
      case 'Present':
        return 'status-present';
      case 'Completed':
        return 'status-completed';
      case 'Absent':
        return 'status-absent';
      default:
        return 'status-inactive';
    }
  }

  getAttendanceStatusText(user: UserWithAttendance): string {
    if (!user.isActive) return 'Inactive';
    return user.attendance_today.status;
  }

  formatWeekRange(weekStart: string, weekEnd: string): string {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    
    return `${start.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}`;
  }

  clearError() {
    this.error = null;
  }

  // Métodos para speakers (mantenidos para compatibilidad)
  getSpeakerBatteryStatus(batteryPercentage: number): string {
    if (batteryPercentage > 60) return 'Good';
    if (batteryPercentage > 30) return 'Medium';
    if (batteryPercentage > 10) return 'Low';
    return 'Critical';
  }

  getSpeakerStatusText(speaker: Speaker): string {
    if (speaker.state) {
      return speaker.usageSessions && speaker.usageSessions.length > 0 ? 'In Use' : 'Active';
    }
    return 'Inactive';
  }

  getAverageBatteryPercentage(): number {
    if (this.dashboardData.recentSpeakers.length === 0) {
      return 0;
    }
    
    const total = this.dashboardData.recentSpeakers.reduce((sum, speaker) => sum + speaker.batteryPercentage, 0);
    return Math.round(total / this.dashboardData.recentSpeakers.length);
  }

  // Método para obtener el año de una fecha
  getYearFromDateString(dateString: string): number {
    return new Date(dateString).getFullYear();
  }

  // Método para stopPropagation en eventos
  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  navigateToUsers() {
    console.log('Navigate to users management');
    this.router.navigate(['/dashboard/users-management']);
  }

  navigateToSpeakers() {
    console.log('Navigate to speakers management');
    this.router.navigate(['/dashboard/speakers-management']);
  }

  navigateToRoles() {
    console.log('Navigate to roles management');
    this.router.navigate(['/dashboard/roles-management']);
  }}