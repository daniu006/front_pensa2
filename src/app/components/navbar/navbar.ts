import { Component, Input, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Logo } from '../logo/logo';
import { loginApi } from '../../constants/endPoints';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, Logo],
  templateUrl: './navbar.html',
  styleUrls: ['./navbar.css']
})
export class Navbar implements OnInit {
  @Input() showLogoutButton: boolean = true;
  username: string = 'Username';

  constructor(private router: Router) {}

  ngOnInit(): void {
    // Obtener el username del localStorage al inicializar el componente
    if (typeof window !== 'undefined') {
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        this.username = storedUsername;
      }
    }
  }

  onLogout(): void {
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
      
      
      // Redirigir a la página de login
      this.router.navigate([`${loginApi}`]).then(() => {
        console.log('Logged out successfully');
      });
    }
  }
}