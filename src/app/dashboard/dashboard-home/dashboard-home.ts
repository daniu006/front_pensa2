import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Navbar } from '../../components/navbar/navbar';
import { loginApi } from '../../constants/endPoints';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-dashboard-home',
  standalone: true,
  imports: [CommonModule, RouterLink, Navbar],
  templateUrl: './dashboard-home.html',
  styleUrls: ['./dashboard-home.css'],
})
export class DashboardHome implements OnInit {
  username: string = 'Username';
  userRole: string | null = null;
  flipCard: boolean = false;
  flipCardAI: boolean = false;
  private router = inject(Router);

  constructor(private authService: AuthService) {} // Inyectar AuthService

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      // Obtener información del usuario desde localStorage
      this.loadUserInfo();
    }
  }

  private loadUserInfo(): void {
    // Método 1: Usar AuthService (recomendado)
    const currentUser = this.authService.getCurrentUser();
    if (currentUser) {
      this.username = currentUser.username || 'User';
      this.userRole = currentUser.roleName;
      return;
    }

    // Método 2: Fallback - obtener desde userSession en localStorage
    const userSession = localStorage.getItem('userSession');
    if (userSession) {
      try {
        const sessionData = JSON.parse(userSession);
        this.username = sessionData.username || 'User';
        this.userRole = sessionData.roleName;
        console.log('Loaded from userSession:', sessionData);
        return;
      } catch (e) {
        console.error('Error parsing userSession', e);
      }
    }

    // Método 3: Fallback - obtener directamente desde localStorage individual
    this.username = localStorage.getItem('username') || 'User';
    this.userRole = localStorage.getItem('roleName');
    console.log('Loaded from individual localStorage items:', {
      username: this.username,
      role: this.userRole
    });

    // Método 4: Último fallback - decodificar token JWT
    if (!this.userRole) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.username = payload.username || payload.name || 'User';
          this.userRole = payload.roleName || payload.role;
          console.log('Loaded from JWT token:', payload);
        } catch (e) {
          console.error('Invalid token', e);
        }
      }
    }

    // Si aún no tenemos rol, mostrar advertencia
    if (!this.userRole) {
      console.warn('⚠️ No user role detected. User might need to re-login.');
    }
  }

  // Método para verificar si el usuario es SUPERADMIN
  isSuperAdmin(): boolean {
    const isSuper = this.userRole === 'SUPERADMIN';
    return isSuper;
  }

  // Método para verificar si el usuario es USER
  isUser(): boolean {
    const isUserRole = this.userRole === 'USER';
    return isUserRole;
  }

  // Método para verificar si el usuario es ADMIN
  isAdmin(): boolean {
    const isAdminRole = this.userRole === 'ADMIN';
    return isAdminRole;
  }

  // Método adicional para verificar cualquier rol específico
  hasRole(role: string): boolean {
    const hasSpecificRole = this.userRole === role;
    return hasSpecificRole;
  }

  // Método para verificar si el usuario tiene permisos de administrador (ADMIN o SUPERADMIN)
  hasAdminPermissions(): boolean {
    return this.userRole === 'ADMIN' || this.userRole === 'SUPERADMIN';
  }

  logout(): void {
    console.log('Logging out user...');
    
    // Usar AuthService para logout si está disponible
    if (this.authService.logout) {
      this.authService.logout();
    } else {
      // Fallback: limpiar manualmente
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      localStorage.removeItem('roleName');
      localStorage.removeItem('userSession');
    }
    
    // Redirigir al login
    this.router.navigate([`${loginApi}`]).then(() => {
      console.log('User logged out successfully');
    });
  }

}