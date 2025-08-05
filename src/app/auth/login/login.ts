import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Logo } from '../../components/logo/logo';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  templateUrl: './login.html',
  styleUrls: ['./login.css'],
  imports: [CommonModule, FormsModule, Logo]
})
export class Login {
  usernameOrEmail: string = '';
  password: string = '';
  errorMessage: string = '';
  isLoading: boolean = false;
  showPassword: boolean = false;

  constructor(
    //UrlBackend
    private authService: AuthService, // Cambiar a authService
    private router: Router
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

    // Usar AuthService en lugar de ApiService
    this.authService.login(credentials)
      .subscribe({
        next: (response) => {
          this.isLoading = false;
          this.router.navigate(['/home']);
        },
        error: (err: any) => { // Tipar explícitamente el error
          console.error('Login error:', err);
          this.isLoading = false;
          this.errorMessage = err.error?.message || 'An error occurred during login. Please try again.';
        }
      });
  }
}