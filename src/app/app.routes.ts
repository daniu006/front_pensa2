import { Routes } from '@angular/router';
import { DashboardHome } from './dashboard/dashboard-home/dashboard-home';
import { History } from './dashboard/history/history';
import { Login } from './auth/login/login';
import { SplashScreen } from './splash-screen/splash-screen';
import { Register } from './auth/register/register';
import { SelectPanel } from './dashboard/select-panel/select-panel';
import { AuthGuard } from './auth/guards/auth-guard';
import { AdvancedSettingsComponent } from './dashboard/advanced-settings/advanced-settings';
import { UsersManagementComponent } from './dashboard/users-management/users-management';
import { SpeakersManagementComponent } from './dashboard/speakers-management/speakers-management';
import { ControlPanelComponent } from './dashboard/control-panel/control-panel';

export const routes: Routes = [
    // Rutas públicas (no requieren autenticación)
    { path: '', component: SplashScreen },
    { path: 'auth/login', component: Login },
    
    // Rutas protegidas (requieren autenticación)
    { path: 'auth/register', component: Register, canActivate: [AuthGuard]},
    { path: 'home', component: DashboardHome, canActivate: [AuthGuard] },
    { path: 'dashboard/control-panel/:id', component: ControlPanelComponent, canActivate: [AuthGuard] },
    { path: 'dashboard/history', component: History, canActivate: [AuthGuard] },
    { path: 'dashboard/select-panel', component: SelectPanel, canActivate: [AuthGuard] },
    
    // Redirección para compatibilidad
    { path: 'dashboard/control-panel', redirectTo: '/dashboard/select-panel', pathMatch: 'full'},
    { path: 'dashboard/adminpanel', component: AdvancedSettingsComponent, canActivate: [AuthGuard]},
    { path: 'dashboard/users-management', component: UsersManagementComponent, canActivate: [AuthGuard]},
    { path: 'dashboard/speakers-management',component: SpeakersManagementComponent, canActivate: [AuthGuard] },
    
    // Ruta wildcard - debe ir al final
    { path: '**', redirectTo: '/' }
];