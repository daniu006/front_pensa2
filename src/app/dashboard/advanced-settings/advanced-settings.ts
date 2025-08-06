import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Location } from '@angular/common';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { User, UserService } from '../../services/user.service';
import { apiURL } from '../../services/api';
import { loginApi, speakersApi } from '../../constants/endPoints';

// Se elimina la importación de User y UserService ya que los datos se obtendrán directamente.

// --- NUEVAS INTERFACES PARA DATOS DE ASISTENCIA ---
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

// --- Interfaz de Speaker (sin cambios) ---
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

@Component({
  selector: 'app-advanced-settings',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  providers: [UserService],
  templateUrl: './advanced-settings.html',
  styleUrl: './advanced-settings.css'
})
export class AdvancedSettingsComponent implements OnInit, OnDestroy {
  
  private readonly API_URL = apiURL;
  // URL del backend de FastAPI
  private readonly FASTAPI_URL = 'https://fastapi-production-b6bb.up.railway.app';

  // Datos del dashboard (actualizado para usar la nueva interfaz)
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
    allUsers: [] as UserWithAttendance[], // Cambiado de recentUsers a allUsers
    recentSpeakers: [] as Speaker[]
  };

  loading = false;
  error: string | null = null;
  currentTime = '';
  private timeInterval: any;
  private subscription = new Subscription();

  constructor(
    private router: Router,
    private location: Location,
    private userService: UserService,
    private http: HttpClient
  ) {
    // Configurar para que siempre recargue al navegar a la misma ruta
    this.router.onSameUrlNavigation = 'reload';
  }

  ngOnInit() {
    // Inicializar la fecha y hora
    this.updateCurrentTime();
    
    // Actualizar cada segundo
    this.timeInterval = setInterval(() => {
      this.updateCurrentTime();
    }, 1000);

    // Cargar datos del dashboard
    this.loadDashboardData();

    // Suscribirse a los cambios en la lista de usuarios
    // Se elimina la suscripción a userService.users$ ya que se carga directamente
  }

  ngOnDestroy() {
    // Limpiar el intervalo al destruir el componente
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
    
    // Limpiar suscripciones
    this.subscription.unsubscribe();
  }

  // Carga todos los datos del dashboard
  loadDashboardData() {
    this.loading = true;
    this.error = null;
    
    console.log('🔄 Loading dashboard data (users and speakers)...');
    
    this.loadUsersWithAttendance(); // Cargar usuarios con asistencia
    this.loadSpeakersData(); // Cargar speakers
  }

  // Cargar datos de usuarios y su asistencia desde FastAPI
  private loadUsersWithAttendance() {
    console.log('🔄 Loading users with attendance data...');
    const usersUrl = `${this.FASTAPI_URL}/users/with-attendance`;
    
    this.subscription.add(
      this.http.get<UserWithAttendance[]>(usersUrl).subscribe({
        next: (users) => {
          console.log('✅ Users with attendance loaded successfully:', users);
          this.updateUserStats(users);
        },
        error: (error) => {
          console.error('❌ Error loading users with attendance:', error);
          this.error = 'Failed to load user attendance data. Please try again.';
          this.updateUserStats([]); // Limpiar datos de usuario en caso de error
        }
      })
    );
  }

  // Cargar datos de speakers (sin cambios)
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
          
          this.loading = false; // El loading termina aquí
        },
        error: (error) => {
          console.error('❌ Error loading speakers:', error);
          this.setDefaultSpeakerStats();
          this.loading = false; // El loading también termina aquí
        }
      })
    );
  }

  // Actualizar estadísticas y lista de usuarios
  private updateUserStats(users: UserWithAttendance[]) {
    this.dashboardData.stats.totalUsers = users.length;
    this.dashboardData.stats.activeUsers = users.filter(user => user.isActive).length;
    this.dashboardData.stats.inactiveUsers = users.length - this.dashboardData.stats.activeUsers;
    this.dashboardData.stats.lastUpdate = new Date();
    this.dashboardData.allUsers = users; // Guardar la lista completa de usuarios

    console.log('👥 User stats updated:', {
      total: this.dashboardData.stats.totalUsers,
      active: this.dashboardData.stats.activeUsers,
      inactive: this.dashboardData.stats.inactiveUsers
    });
  }

  // Método para actualizar las estadísticas de speakers
  private updateSpeakerStats(speakers: Speaker[]) {
    const activeSpeakers = speakers.filter(speaker => speaker.state).length;
    const inactiveSpeakers = speakers.filter(speaker => !speaker.state).length;

    // Actualizar estadísticas de speakers
    this.dashboardData.stats.totalSpeakers = speakers.length;
    this.dashboardData.stats.activeSpeakers = activeSpeakers;
    this.dashboardData.stats.inactiveSpeakers = inactiveSpeakers;
    this.dashboardData.stats.lastUpdate = new Date();

    // Obtener los 3 speakers más recientes
    this.dashboardData.recentSpeakers = speakers
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    console.log('🔊 Speaker stats updated:', {
      total: this.dashboardData.stats.totalSpeakers,
      active: this.dashboardData.stats.activeSpeakers,
      inactive: this.dashboardData.stats.inactiveSpeakers
    });
  }

  // Establecer estadísticas por defecto para speakers en caso de error
  private setDefaultSpeakerStats() {
    this.dashboardData.stats.totalSpeakers = 0;
    this.dashboardData.stats.activeSpeakers = 0;
    this.dashboardData.stats.inactiveSpeakers = 0;
    this.dashboardData.recentSpeakers = [];
    
    console.log('⚠️ Using default speaker stats due to error');
  }

  // Método para establecer datos por defecto en caso de error
  private setDefaultData() {
    this.dashboardData.stats = {
      totalUsers: 0,
      activeUsers: 0,
      inactiveUsers: 0,
      totalSpeakers: 0,
      activeSpeakers: 0,
      inactiveSpeakers: 0,
      lastUpdate: new Date()
    };
    
    this.dashboardData.allUsers = [];
    this.dashboardData.recentSpeakers = [];
  }

  // Método para actualizar la fecha y hora actual
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

  // Método para volver atrás
  goBack() {
    this.router.navigate(['/home']);
  }

  // Método para refresh
  refreshData() {
    console.log('🔄 Refreshing dashboard data...');
    this.loadDashboardData();
  }


    onLogout(): void {
    // Verificar que estamos en el navegador
    if (typeof window !== 'undefined') {
      // Limpiar todos los datos de autenticación del localStorage
      localStorage.clear();
      
      // También limpiar el token genérico que usa el guard
    }
    
    // Redirigir al login
    this.router.navigate(['/auth/login']);
  }

  // Método para desconectar/logout
  logout() {
    // Mostrar confirmación
    const confirmLogout = confirm('¿Estás seguro de que quieres desconectarte?');
    
    if (confirmLogout) {
      // Limpiar cualquier dato de sesión
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      localStorage.removeItem('roleName');
      localStorage.removeItem('userSession');
      
      // Limpiar el intervalo de tiempo
      if (this.timeInterval) {
        clearInterval(this.timeInterval);
      }
      
      // Redirigir a la página de login
      this.router.navigate([`${loginApi}`]).then(() => {
        console.log('Logged out successfully');
      });
    }
  }
  
  // Navegación a diferentes secciones
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
  }

  // Método utilitario para obtener avatar del usuario
  getUserAvatar(user: UserWithAttendance): string {
    return (user.firstName || user.name).charAt(0).toUpperCase();
  }

  // Método utilitario para formatear la fecha de creación
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

  // Método para obtener el rol formateado
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

  // Método para limpiar errores
  clearError() {
    this.error = null;
  }

  // Métodos utilitarios para speakers
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

  // Método para calcular el promedio de batería de forma segura
  getAverageBatteryPercentage(): number {
    if (this.dashboardData.recentSpeakers.length === 0) {
      return 0;
    }
    
    const total = this.dashboardData.recentSpeakers.reduce((sum, speaker) => sum + speaker.batteryPercentage, 0);
    return Math.round(total / this.dashboardData.recentSpeakers.length);
  }

  // Métodos utilitarios para alertas (mantenidos para compatibilidad)
  getAlertClass(type: string): string {
    return `alert-${type}`;
  }

  getAlertIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'info': '&#8505;',
      'warning': '&#9888;',
      'error': '&#10060;',
      'success': '&#9989;'
    };
    return icons[type] || '&#8505;';
  }

  handleAlertAction(alert: any) {
    console.log('Alert action:', alert);
  }
}