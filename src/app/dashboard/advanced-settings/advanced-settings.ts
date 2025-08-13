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
  empleado_info: UserWithAttendance | null;
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
  selectedPeriod: string = TimePeriod.TODAY;
  selectedStatus = '';
  selectedRole = '';
  customStartDate = '';
  customEndDate = '';

  private searchSubject = new Subject<string>();

  TimePeriod = TimePeriod;

  // Vista activa: Inicia en null para no mostrar nada al principio.
  activeView: 'dashboard' | 'weekly' | 'monthly' | null = null;

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

  // ===== NUEVO: Propiedades para paginación de empleados =====
  initialUserLimit = 6;
  displayedUsers: UserWithAttendance[] = [];
  // =========================================================

  attendanceStats: DashboardStats | null = null;
  weeklyStats: WeeklyStats[] = [];
  monthlyStats: MonthlyStats[] = [];
  selectedEmployeeReport: AttendanceReport | null = null;

  loading = false;
  error: string | null = null;
  currentTime = '';
  private timeInterval: any;
  private subscription = new Subscription();

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
    console.log('🚀 Initializing Advanced Settings Component...');

    this.updateCurrentTime();

    this.timeInterval = setInterval(() => {
      this.updateCurrentTime();
    }, 1000);

    this.subscription.add(
      this.searchSubject.pipe(
        debounceTime(300),
        distinctUntilChanged()
      ).subscribe(searchTerm => {
        this.performSearch();
      })
    );

    this.loadInitialData();
  }

  ngOnDestroy() {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
    this.subscription.unsubscribe();
  }

  private loadInitialData() {
    console.log('📊 Loading initial dashboard data...');
    this.loading = true;
    this.error = null;

    this.loadAttendanceStats();
    this.loadAllUsersOnInit();
    this.loadSpeakersData();
  }

  private loadAllUsersOnInit() {
    console.log('👥 Loading ALL users on initialization (no filters)...');

    const allUsersUrl = `${this.FASTAPI_URL}/attendance/search`;

    this.subscription.add(
      this.http.get<UserWithAttendance[]>(allUsersUrl).subscribe({
        next: (users) => {
          console.log('✅ ALL users loaded on init:', users.length, 'users');

          this.dashboardData.allUsers = users;
          this.dashboardData.filteredUsers = users;
          this.updateUserStats(users);
          this.updateDisplayedUserList(); // <-- CAMBIO: Actualiza la lista visible
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading initial users:', error);
          this.error = 'Failed to load user data. Please refresh the page.';
          this.dashboardData.filteredUsers = [];
          this.dashboardData.allUsers = [];
          this.updateDisplayedUserList(); // <-- CAMBIO: Actualiza la lista visible
          this.loading = false;
        }
      })
    );
  }

  loadDashboardData() {
    console.log('🔄 Loading dashboard data for view:', this.activeView);

    this.loading = true;
    this.error = null;

    if (!this.activeView) {
      this.loading = false;
      return;
    }

    switch (this.activeView) {
      case 'dashboard':
        this.loadAttendanceStats();
        if (this.hasActiveFilters()) {
          this.loadUsersWithSearch();
        } else if (this.dashboardData.allUsers.length === 0) {
          this.loadAllUsersOnInit();
        } else {
          this.loading = false;
        }
        break;
      case 'weekly':
        this.loadWeeklyStats();
        break;
      case 'monthly':
        this.loadMonthlyStats();
        break;
    }

    this.loadSpeakersData();
  }

  private hasActiveFilters(): boolean {
    return !!(
      this.searchTerm.trim() ||
      this.selectedStatus ||
      this.selectedRole ||
      this.selectedPeriod !== TimePeriod.TODAY ||
      (this.selectedPeriod === TimePeriod.CUSTOM.toString() && (this.customStartDate || this.customEndDate))
    );
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
    this.loading = true; // Activa el loading aquí
    const params = new URLSearchParams();

    if (this.searchTerm.trim()) {
      params.append('search', this.searchTerm.trim());
    }
    if (this.selectedPeriod && this.selectedPeriod !== TimePeriod.TODAY) {
      params.append('period', this.selectedPeriod);
    }
    if (this.selectedStatus) {
      params.append('status', this.selectedStatus);
    }
    if (this.selectedRole) {
      params.append('role', this.selectedRole);
    }
    if (this.selectedPeriod === TimePeriod.CUSTOM) {
      if (this.customStartDate) params.append('start_date', this.customStartDate);
      if (this.customEndDate) params.append('end_date', this.customEndDate);
    }

    const searchUrl = `${this.FASTAPI_URL}/attendance/search?${params.toString()}`;
    console.log('🌐 Search URL:', searchUrl);

    this.subscription.add(
      this.http.get<UserWithAttendance[]>(searchUrl).subscribe({
        next: (users) => {
          console.log('✅ Filtered users loaded:', users.length, 'users');
          this.dashboardData.filteredUsers = users;
          this.updateUserStats(users);
          this.updateDisplayedUserList(); // <-- CAMBIO: Actualiza la lista visible
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading filtered users:', error);
          this.error = 'Failed to load filtered user data. Please try again.';
          this.dashboardData.filteredUsers = [];
          this.updateDisplayedUserList(); // <-- CAMBIO: Actualiza la lista visible
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
          if (response.success && response.data) {
            this.updateSpeakerStats(response.data);
          } else {
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

  onSearchChange(event: any) {
    this.searchTerm = event.target.value;
    this.searchSubject.next(this.searchTerm);
  }

  onPeriodChange(period: string) {
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
    console.log('🔍 Performing search with filters...');

    if (!this.hasActiveFilters()) {
      console.log('📋 No active filters, showing all users...');
      this.dashboardData.filteredUsers = this.dashboardData.allUsers;
      this.updateUserStats(this.dashboardData.allUsers);
      this.updateDisplayedUserList(); // <-- CAMBIO: Actualiza la lista visible
      return;
    }

    this.loadUsersWithSearch();
  }

  clearFilters() {
    console.log('🗑️ Clearing all filters...');

    this.searchTerm = '';
    this.selectedPeriod = TimePeriod.TODAY;
    this.selectedStatus = '';
    this.selectedRole = '';
    this.customStartDate = '';
    this.customEndDate = '';

    this.dashboardData.filteredUsers = this.dashboardData.allUsers;
    this.updateUserStats(this.dashboardData.allUsers);
    this.updateDisplayedUserList(); // <-- CAMBIO: Actualiza la lista visible

    console.log('✅ Filters cleared, showing all users:', this.dashboardData.allUsers.length);
  }

  // ===== NUEVO: Método para actualizar la lista de empleados visibles =====
  private updateDisplayedUserList(): void {
    console.log('🔄 Updating displayed user list...');
    this.displayedUsers = this.dashboardData.filteredUsers.slice(0, this.initialUserLimit);
  }

  // ===== NUEVO: Método para el botón "Ver más / Ver menos" =====
  toggleViewMoreUsers(): void {
    if (this.displayedUsers.length === this.dashboardData.filteredUsers.length) {
      // Si se muestran todos, volver a la vista inicial
      this.displayedUsers = this.dashboardData.filteredUsers.slice(0, this.initialUserLimit);
    } else {
      // Si se muestra una parte, mostrarlos todos
      this.displayedUsers = this.dashboardData.filteredUsers;
    }
  }

  setActiveView(view: 'dashboard' | 'weekly' | 'monthly') {
    console.log('🔄 Switching to view:', view);
    if (this.activeView === view) {
      this.activeView = null; // Permite ocultar la vista si se hace clic de nuevo
    } else {
      this.activeView = view;
      this.loadDashboardData();
    }
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

  private updateUserStats(users: UserWithAttendance[]) {
    this.dashboardData.stats.totalUsers = users.length;
    this.dashboardData.stats.activeUsers = users.filter(user => user.isActive).length;
    this.dashboardData.stats.inactiveUsers = users.length - this.dashboardData.stats.activeUsers;
    this.dashboardData.stats.lastUpdate = new Date();
  }

  private updateSpeakerStats(speakers: Speaker[]) {
    const activeSpeakers = speakers.filter(speaker => speaker.state).length;
    this.dashboardData.stats.totalSpeakers = speakers.length;
    this.dashboardData.stats.activeSpeakers = activeSpeakers;
    this.dashboardData.stats.inactiveSpeakers = speakers.length - activeSpeakers;
    this.dashboardData.stats.lastUpdate = new Date();

    this.dashboardData.recentSpeakers = speakers
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }

  private setDefaultSpeakerStats() {
    this.dashboardData.stats.totalSpeakers = 0;
    this.dashboardData.stats.activeSpeakers = 0;
    this.dashboardData.stats.inactiveSpeakers = 0;
    this.dashboardData.recentSpeakers = [];
  }

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

    this.currentTime = now.toLocaleDateString('es-ES', options);
  }

  goBack() {
    this.router.navigate(['/home']);
  }

  refreshData() {
    console.log('🔄 Refreshing all data...');
    this.loading = true;
    this.error = null;

    this.loadAttendanceStats();
    this.loadAllUsersOnInit(); // Esto ya actualiza la lista de empleados
    this.loadSpeakersData();

    if (this.activeView === 'weekly') this.loadWeeklyStats();
    if (this.activeView === 'monthly') this.loadMonthlyStats();
  }

  logout() {
    if (confirm('¿Estás seguro de que quieres desconectarte?')) {
      localStorage.clear();
      if (this.timeInterval) clearInterval(this.timeInterval);
      this.router.navigate([`${loginApi}`]);
    }
  }

  getUserAvatar(user: UserWithAttendance): string {
    const name = user.firstName || user.name || user.email.split('@')[0] || 'U';
    return name.charAt(0).toUpperCase();
  }

  formatCreatedDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  getUserRole(user: UserWithAttendance): string {
    switch (user.role) {
      case 'SUPERADMIN': return 'Super Admin';
      case 'ADMIN': return 'Administrador';
      case 'USER': return 'Usuario';
      default: return user.role;
    }
  }

  getAttendanceStatusClass(status: string): string {
    switch (status) {
      case 'Presente': return 'status-present';
      case 'Completado': return 'status-completed';
      case 'Ausente': return 'status-absent';
      default: return 'status-inactive';
    }
  }

  getAttendanceStatusText(user: UserWithAttendance): string {
    if (!user.isActive) return 'Inactivo';
    switch (user.attendance_today.status) {
      case 'Present': return 'Presente';
      case 'Completed': return 'Completado';
      case 'Absent': return 'Ausente';
      default: return 'Inactivo';
    }
  }

  formatWeekRange(weekStart: string, weekEnd: string): string {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    return `${start.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}`;
  }

  clearError() {
    this.error = null;
  }

  getYearFromDateString(dateString: string): number {
    return new Date(dateString).getFullYear();
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }
}
