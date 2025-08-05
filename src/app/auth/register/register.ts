import { Component } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Logo } from '../../components/logo/logo';
import { loginApi, registerApi } from '../../constants/endPoints';
import { apiURL } from '../../services/api';

@Component({
  selector: 'app-register',
  templateUrl: './register.html',
  styleUrls: ['./register.css'],
    imports: [CommonModule, FormsModule, HttpClientModule, RouterLink, Logo]
})


export class Register {
  username: string = '';
  email: string = '';
  password: string = '';
  errorMessage: string = '';
  successMessage: string = '';

  constructor(private http: HttpClient, private router: Router) {}

  onSubmit() {
    if (!this.username || !this.email || !this.password) {
      this.errorMessage = 'Todos los campos son obligatorios.';
      return;
    }

    if (this.password.length < 4 || this.password.length > 12) {
      this.errorMessage = 'La contraseña debe tener entre 4 y 12 caracteres.';
      return;
    }

    const payload = {
      username: this.username,
      email: this.email,
      password: this.password,
    };

    this.http.post(`${apiURL}${registerApi}`, payload)
      .subscribe({
        next: response => {
          this.successMessage = '¡Cuenta creada exitosamente!';
          this.errorMessage = '';
          setTimeout(() => this.router.navigate([`${loginApi}`]), 3000);
        },
        error: error => {
          this.successMessage = '';
          this.errorMessage = error.error?.message || 'Error al registrar.';
        }
      });
  }
}
