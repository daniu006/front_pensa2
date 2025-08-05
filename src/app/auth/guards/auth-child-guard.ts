import { CanActivateChildFn, Router } from '@angular/router';
import { inject } from '@angular/core';

export const AuthChildGuard: CanActivateChildFn = (childRoute, state) => {
  const router = inject(Router);
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('token');
    if (token) {
      return true;
    } else {
      // Si no hay token, redirigir a login
      router.navigate(['/auth/login']);
      return false;
    }
  }
  return false;
};


