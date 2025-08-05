import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { isPlatformBrowser } from '@angular/common';
import { apiURL } from './api';
import { 
  createUserApi,
  deleteUserApi, 
  getUserByIdApi, 
  updateUserApi, 
  usersApi 
} from '../constants/endPoints';

export interface User {
  id: number; // Cambiado a number para coincidir con el backend
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateUserRequest {
  username: string;
  email: string;
  password: string;
  role: string;
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export interface UpdateUserRequest {
  username?: string;
  email?: string;
  password?: string;
  role?: string;
  isActive?: boolean;
  firstName?: string;
  lastName?: string;
}

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private readonly API_URL = apiURL;
  private usersSubject = new BehaviorSubject<User[]>([]);
  public users$ = this.usersSubject.asObservable();

  constructor(
    private http: HttpClient,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {}

  // Método seguro para acceder al localStorage
  private getFromStorage(key: string): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem(key);
    }
    return null;
  }

  // Método seguro para guardar en localStorage
  private setInStorage(key: string, value: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem(key, value);
    }
  }

  // Método seguro para eliminar del localStorage
  private removeFromStorage(key: string): void {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem(key);
    }
  }

  private getHeaders(): HttpHeaders {
    const token = this.getFromStorage('accessToken');
    return new HttpHeaders({
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    });
  }

  private handleError(error: HttpErrorResponse): Observable<never> {
    console.error('HTTP Error:', error);
    
    let errorMessage = '';
    
    if (error.error instanceof ErrorEvent) {
      // Error del lado del cliente
      errorMessage = `Client error: ${error.error.message}`;
    } else {
      // Error del lado del servidor
      switch (error.status) {
        case 400:
          errorMessage = 'Bad Request: Please check your input data';
          if (error.error?.message) {
            errorMessage = error.error.message;
          }
          break;
        case 401:
          errorMessage = 'Unauthorized: Please log in again';
          break;
        case 403:
          errorMessage = 'Forbidden: You do not have permission to perform this action';
          break;
        case 404:
          errorMessage = 'Not Found: The requested resource was not found';
          break;
        case 409:
          // Manejo específico para conflictos
          if (error.error?.message) {
            errorMessage = error.error.message;
          } else {
            errorMessage = 'Username or email already exists';
          }
          break;
        case 422:
          errorMessage = 'Validation Error: Please check your input';
          if (error.error?.message) {
            errorMessage = error.error.message;
          }
          break;
        case 500:
          errorMessage = 'Internal Server Error: Please try again later';
          break;
        case 0:
          errorMessage = 'Network Error: Please check your connection';
          break;
        default:
          errorMessage = `Server Error: ${error.status} - ${error.statusText}`;
          if (error.error?.message) {
            errorMessage = error.error.message;
          }
      }
    }

    console.error('Processed error message:', errorMessage);
    return throwError(() => new Error(errorMessage));
  }

  getAllUsers(): Observable<User[]> {
    console.log('🔍 Fetching all users from:', `${this.API_URL}${usersApi}`);
    
    return this.http.get<User[]>(`${this.API_URL}${usersApi}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(users => {
        console.log('✅ Users loaded successfully:', users);
        this.usersSubject.next(users);
      }),
      catchError(this.handleError.bind(this))
    );
  }

  getUserById(id: number): Observable<User> {
    console.log('🔍 Fetching user by ID:', id);
    
    return this.http.get<User>(`${this.API_URL}${getUserByIdApi}${id}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(user => console.log('✅ User fetched successfully:', user)),
      catchError(this.handleError.bind(this))
    );
  }

  createUser(userData: CreateUserRequest): Observable<User> {
    console.log('📝 Creating user with data:', { ...userData, password: '[HIDDEN]' });
    
    // Validar roles válidos
    const validRoles = ['SUPERADMIN', 'ADMIN', 'USER'];
    if (!validRoles.includes(userData.role)) {
      return throwError(() => new Error('Invalid role. Must be SUPERADMIN, ADMIN, or USER'));
    }

    // Preparar datos limpios
    const cleanData = {
      username: userData.username.trim(),
      email: userData.email.trim(),
      password: userData.password,
      role: userData.role,
      isActive: userData.isActive !== undefined ? userData.isActive : true
    };

    return this.http.post<User>(`${this.API_URL}${createUserApi}`, cleanData, {
      headers: this.getHeaders()
    }).pipe(
      tap(newUser => {
        console.log('✅ User created successfully:', newUser);
        // Actualizar la lista local de usuarios
        const currentUsers = this.usersSubject.value;
        this.usersSubject.next([...currentUsers, newUser]);
      }),
      catchError((error) => {
        console.error('❌ createUser failed:', error);
        return this.handleError(error);
      })
    );
  }

  updateUser(id: number, userData: UpdateUserRequest): Observable<User> {
    console.log('🔄 Updating user:', id, 'with data:', { 
      ...userData, 
      password: userData.password ? '[HIDDEN]' : undefined 
    });
    
    // Validar roles si se está actualizando
    if (userData.role) {
      const validRoles = ['SUPERADMIN', 'ADMIN', 'USER'];
      if (!validRoles.includes(userData.role)) {
        return throwError(() => new Error('Invalid role. Must be SUPERADMIN, ADMIN, or USER'));
      }
    }

    // Limpiar datos
    const cleanData: any = {};
    if (userData.username) cleanData.username = userData.username.trim();
    if (userData.email) cleanData.email = userData.email.trim();
    if (userData.password) cleanData.password = userData.password;
    if (userData.role) cleanData.role = userData.role;
    if (userData.isActive !== undefined) cleanData.isActive = userData.isActive;

    return this.http.patch<User>(`${this.API_URL}${updateUserApi}${id}`, cleanData, {
      headers: this.getHeaders()
    }).pipe(
      tap(updatedUser => {
        console.log('✅ User updated successfully:', updatedUser);
        // Actualizar la lista local de usuarios
        const currentUsers = this.usersSubject.value;
        const updatedUsers = currentUsers.map(user => 
          user.id === id ? updatedUser : user
        );
        this.usersSubject.next(updatedUsers);
      }),
      catchError((error) => {
        console.error('❌ updateUser failed:', error);
        return this.handleError(error);
      })
    );
  }

  deleteUser(id: number): Observable<any> {
    console.log('🗑️ Deleting user:', id);
    
    return this.http.delete(`${this.API_URL}${deleteUserApi}${id}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => {
        console.log('✅ User deleted successfully');
        // Actualizar la lista local de usuarios
        const currentUsers = this.usersSubject.value;
        const filteredUsers = currentUsers.filter(user => user.id !== id);
        this.usersSubject.next(filteredUsers);
      }),
      catchError((error) => {
        console.error('❌ deleteUser failed:', error);
        return this.handleError(error);
      })
    );
  }

  // Método para activar/desactivar usuario
  toggleUserStatus(id: number, isActive: boolean): Observable<User> {
    console.log('🔄 Toggling user status:', id, 'to', isActive);
    
    return this.updateUser(id, { isActive });
  }

  // Método para limpiar el cache de usuarios
  clearUsersCache(): void {
    this.usersSubject.next([]);
  }

  // Método para refrescar usuarios
  refreshUsers(): Observable<User[]> {
    return this.getAllUsers();
  }

  // Métodos adicionales para compatibilidad con localStorage
  setAuthToken(token: string): void {
    this.setInStorage('accessToken', token);
  }

  getAuthToken(): string | null {
    return this.getFromStorage('accessToken');
  }

  clearAuthToken(): void {
    this.removeFromStorage('accessToken');
  }

  // Métodos para cache
  getCachedUsers(): User[] {
    return this.usersSubject.value;
  }

  hasCachedUsers(): boolean {
    return this.usersSubject.value.length > 0;
  }
}
