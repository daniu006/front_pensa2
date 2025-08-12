import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Logo } from '../../components/logo/logo';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [CommonModule, FormsModule, Logo, HttpClientModule]
})
export class Login {
  usernameOrEmail: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  showPassword: boolean = false;

  private readonly QR_API_URL = 'https://fastapi-production-b6bb.up.railway.app';

  constructor(
    private authService: AuthService,
    private router: Router,
    private http: HttpClient
  ) {}

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  onLogin() {
    if (!this.usernameOrEmail || !this.password) {
      this.errorMessage = 'Please fill in all fields.';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const credentials = {
      usernameOrEmail: this.usernameOrEmail,
      password: this.password
    };

    // Usar AuthService para login
    this.authService.login(credentials)
      .subscribe({
        next: async (response) => {
          console.log('✅ Login exitoso:', response);
          
          // NUEVO: Regenerar QR automáticamente después del login exitoso
          try {
            await this.regenerateQRAfterLogin(response);
            console.log('✅ QR regenerado exitosamente tras login');
          } catch (qrError) {
            console.warn('⚠️ Error al regenerar QR tras login:', qrError);
            // No mostramos error al usuario, solo registramos en consola
            // El QR se puede regenerar manualmente desde el dashboard
          }
          
          this.isLoading = false;
          this.router.navigate(['/home']);
        },
        error: (err: any) => {
          console.error('❌ Login error:', err);
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'An error occurred during login. Please try again.';
        }
      });
  }

  /**
   * NUEVA FUNCIÓN: Regenera el QR automáticamente después del login
   */
  private async regenerateQRAfterLogin(loginResponse: any): Promise<void> {
    // Extraer el ID del usuario de la respuesta de login
    const userId = this.extractUserIdFromResponse(loginResponse);
    
    if (!userId) {
      throw new Error('No se pudo obtener el ID del usuario de la respuesta de login');
    }

    console.log(`🔄 Regenerando QR para usuario ${userId}...`);

    // Llamar al endpoint /qr/login del FastAPI
    const qrResponse = await this.http.post<any>(`${this.QR_API_URL}/qr/login`, {
      empleado_id: userId
    }).toPromise();

    if (!qrResponse) {
      throw new Error('Respuesta vacía del servidor al regenerar QR');
    }

    console.log('🆕 Nuevo QR generado:', {
      qr_id: qrResponse.id,
      empleado_id: qrResponse.empleado_id,
      is_new: qrResponse.is_new,
      activo: qrResponse.activo
    });

    return qrResponse;
  }

  /**
   * Extrae el ID del usuario de la respuesta de login
   * Adapta esta función según la estructura de tu respuesta de login
   */
  private extractUserIdFromResponse(loginResponse: any): number | null {
    // Buscar el userId en diferentes posibles ubicaciones de la respuesta
    const possiblePaths = [
      loginResponse?.userId,           // Caso 1: directamente en userId
      loginResponse?.user?.id,         // Caso 2: dentro de user.id
      loginResponse?.id,               // Caso 3: directamente en id
      loginResponse?.data?.userId,     // Caso 4: dentro de data.userId
      loginResponse?.data?.user?.id,   // Caso 5: dentro de data.user.id
    ];

    for (const path of possiblePaths) {
      if (path && typeof path === 'number') {
        return path;
      }
    }

    // Si no encontramos el ID en la respuesta, intentar obtenerlo del localStorage
    // que podría haber sido guardado por el AuthService
    try {
      const userSession = localStorage.getItem('userSession');
      if (userSession) {
        const sessionData = JSON.parse(userSession);
        return sessionData.userId || sessionData.id || null;
      }
    } catch (e) {
      console.warn('Error al obtener userId del localStorage:', e);
    }

    return null;
  }
}