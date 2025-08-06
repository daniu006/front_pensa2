import { Component, Input, OnInit, HostListener, Inject, Renderer2 } from '@angular/core';
import { CommonModule, DOCUMENT } from '@angular/common';
import { Router } from '@angular/router';
import { Logo } from '../logo/logo';

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
  userEmail: string = 'usuario@email.com'; // ✅ NUEVA PROPIEDAD
  isUserMenuOpen = false;

  // ✅ CORRECCIÓN: Inyectar Renderer2 y DOCUMENT para manipular el body de forma segura
  constructor(
    private router: Router,
    private renderer: Renderer2,
    @Inject(DOCUMENT) private document: Document
  ) {}

  ngOnInit(): void {
    // Obtener datos del usuario del localStorage al inicializar
    if (typeof window !== 'undefined') {
      const storedUsername = localStorage.getItem('username');
      if (storedUsername) {
        this.username = storedUsername;
      }
      // Puedes hacer lo mismo para el email si lo guardas en localStorage
      // const storedEmail = localStorage.getItem('userEmail');
      // if (storedEmail) {
      //  this.userEmail = storedEmail;
      // }
    }
  }

  /**
   * Alterna el estado del menú de usuario y bloquea/desbloquea el scroll del body
   */
  toggleUserMenu(): void {
    this.isUserMenuOpen = !this.isUserMenuOpen;
    this.updateBodyScroll();
  }

  /**
   * Cierra el menú de usuario y restaura el scroll del body
   */
  closeUserMenu(): void {
    if (this.isUserMenuOpen) {
      this.isUserMenuOpen = false;
      this.updateBodyScroll();
    }
  }

  /**
   * ✅ NUEVO MÉTODO: Añade o remueve la clase 'dropdown-open' del body
   */
  private updateBodyScroll(): void {
    if (this.isUserMenuOpen) {
      this.renderer.addClass(this.document.body, 'dropdown-open');
    } else {
      this.renderer.removeClass(this.document.body, 'dropdown-open');
    }
  }

  onLogout(): void {
    this.closeUserMenu();
    
    const confirmLogout = confirm('¿Estás seguro de que quieres desconectarte?');
    
    if (confirmLogout) {
      console.log('🔍 Iniciando logout...');
      
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('username');
      localStorage.removeItem('roleName');
      localStorage.removeItem('userSession');
      
      console.log('🔍 Datos de sesión limpiados');
      console.log('🔍 Navegando a la ruta raíz...');
      
      this.router.navigate(['/']).then(success => {
        if (success) {
          console.log('✅ Navegación exitosa al login');
        } else {
          console.error('❌ Error en la navegación');
          window.location.href = '/';
        }
      }).catch(error => {
        console.error('❌ Error durante la navegación:', error);
        window.location.href = '/';
      });
    }
  }

 @HostListener('document:keydown.escape')
  onEscapeKey(): void {
    this.closeUserMenu();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    const target = event.target as HTMLElement;
    
    if (!target.closest('.user-menu-container') && this.isUserMenuOpen) {
      this.closeUserMenu();
    }
  }
}