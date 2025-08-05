import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { CreateUserRequest, UpdateUserRequest, User, UserService } from '../../services/user.service';
import { loginApi } from '../../constants/endPoints';

@Component({
  selector: 'app-users-management',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, HttpClientModule],
  providers: [UserService],
  templateUrl: './users-management.html',
  styleUrl: './users-management.css'
})
export class UsersManagementComponent implements OnInit, OnDestroy {
  
  users: User[] = [];
  filteredUsers: User[] = []; // Nueva propiedad para usuarios filtrados
  loading = false;
  error: string | null = null;
  private subscription = new Subscription();

  // Propiedades del filtro
  searchTerm = '';
  filterBy: 'all' | 'name' | 'email' = 'all';

  // Modal control variables
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;
  selectedUser: User | null = null;

  // Form data
  createForm: CreateUserRequest = {
    name: '',
    email: '',
    password: '',
    role: 'USER',
    isActive: true
  };

  editForm: UpdateUserRequest = {
    name: '',
    email: '',
    role: '',
    isActive: true  // ASEGURAR QUE ES BOOLEAN DESDE EL INICIO
  };

  constructor(
    private router: Router,
    private location: Location,
    private userService: UserService
  ) {}

  ngOnInit() {
    this.loadUsers();
    
    // Suscribirse a los cambios en la lista de usuarios
    this.subscription.add(
      this.userService.users$.subscribe(users => {
        this.users = users;
        this.applyFilter(); // Aplicar filtro cuando cambien los usuarios
      })
    );
  }

  ngOnDestroy() {
    this.subscription.unsubscribe();
  }

  loadUsers() {
    this.loading = true;
    this.error = null;
    
    this.subscription.add(
      this.userService.getAllUsers().subscribe({
        next: (users) => {
          this.users = users;
          this.applyFilter(); // Aplicar filtro después de cargar
          this.loading = false;
          console.log('✅ Users loaded in component:', users);
        },
        error: (error) => {
          console.error('❌ Error loading users:', error);
          this.error = error.message || 'Error loading users. Please try again.';
          this.loading = false;
        }
      })
    );
  }

  // Métodos de filtrado
  applyFilter() {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
      return;
    }

    const searchTermLower = this.searchTerm.toLowerCase().trim();
    
    this.filteredUsers = this.users.filter(user => {
      switch (this.filterBy) {
        case 'name':
          return user.name.toLowerCase().includes(searchTermLower);
        case 'email':
          return user.email.toLowerCase().includes(searchTermLower);
        case 'all':
        default:
          return user.name.toLowerCase().includes(searchTermLower) ||
                 user.email.toLowerCase().includes(searchTermLower);
      }
    });

    console.log(`🔍 Filter applied. Found ${this.filteredUsers.length} users out of ${this.users.length}`);
  }

  onSearchChange() {
    this.applyFilter();
  }

  onFilterByChange() {
    this.applyFilter();
  }

  clearSearch() {
    this.searchTerm = '';
    this.filterBy = 'all';
    this.applyFilter();
  }

  // Getter para obtener el conteo de usuarios mostrados
  get displayedUserCount(): number {
    return this.filteredUsers.length;
  }

  get totalUserCount(): number {
    return this.users.length;
  }

  get isFiltered(): boolean {
    return this.searchTerm.trim() !== '' || this.filterBy !== 'all';
  }

  // Métodos básicos para navegación
  goBack() {
    this.router.navigate(['/dashboard']);
  }

  logout() {
       // Mostrar confirmación
    const confirmLogout = confirm('¿Estás seguro de que quieres desconectarte?');
    
    if (confirmLogout) {
      // Limpiar cualquier dato de sesión
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userId');
      localStorage.removeItem('name');
      localStorage.removeItem('roleName');
      localStorage.removeItem('userSession');
      
      // Redirigir a la página de login
      this.router.navigate([`${loginApi}`]).then(() => {
        console.log('Logged out successfully');
      });
    }
  }

  // Create User Modal Methods
  openCreateModal() {
    this.createForm = {
      name: '',
      email: '',
      password: '',
      role: 'USER',
      isActive: true  // BOOLEAN EXPLICITO
    };
    this.showCreateModal = true;
    this.error = null;
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.error = null;
  }

  createUser() {
    if (!this.isCreateFormValid()) {
      this.error = 'Please fill in all required fields';
      return;
    }

    console.log('📝 Creating user with form data:', { 
      ...this.createForm, 
      password: '[HIDDEN]' 
    });

    this.loading = true;
    this.error = null;
    
    // Preparar datos del usuario - ASEGURAR TIPOS CORRECTOS
    const userData: CreateUserRequest = {
      name: this.createForm.name.trim(),
      email: this.createForm.email.trim(),
      password: this.createForm.password,
      role: this.createForm.role,
      isActive: Boolean(this.createForm.isActive) // CONVERTIR EXPLICITAMENTE A BOOLEAN
    };

    this.subscription.add(
      this.userService.createUser(userData).subscribe({
        next: (newUser) => {
          console.log('✅ User created successfully:', newUser);
          this.closeCreateModal();
          this.loading = false;
          // Los usuarios se actualizan automáticamente por el BehaviorSubject
        },
        error: (error) => {
          console.error('❌ Error creating user:', error);
          this.error = error.message || 'Error creating user. Please try again.';
          this.loading = false;
        }
      })
    );
  }

  isCreateFormValid(): boolean {
    return !!(
      this.createForm.name?.trim() &&
      this.createForm.email?.trim() &&
      this.createForm.password &&
      this.createForm.role
    );
  }

  // Edit User Modal Methods
  editUser(user: User) {
    this.selectedUser = { ...user };
    // ASEGURAR QUE TODOS LOS VALORES SEAN DEL TIPO CORRECTO
    this.editForm = {
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: Boolean(user.isActive) // CONVERTIR EXPLICITAMENTE A BOOLEAN
    };
    this.showEditModal = true;
    this.error = null;
    console.log('📝 Editing user:', user);
    console.log('📝 Edit form initialized with:', this.editForm);
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedUser = null;
    this.error = null;
  }

  updateUser() {
    if (!this.selectedUser || !this.isEditFormValid()) {
      this.error = 'Please fill in all required fields';
      return;
    }

    console.log('🔄 Updating user with data:', this.editForm);
    console.log('🔄 isActive type:', typeof this.editForm.isActive, 'value:', this.editForm.isActive);

    this.loading = true;
    this.error = null;

    // Preparar datos para actualizar - ASEGURAR TIPOS CORRECTOS
    const updateData: UpdateUserRequest = {};
    
    // Solo incluir campos que han cambiado y tienen valores válidos
    if (this.editForm.name?.trim() && this.editForm.name.trim() !== this.selectedUser.name) {
      updateData.name = this.editForm.name.trim();
    }
    
    if (this.editForm.email?.trim() && this.editForm.email.trim() !== this.selectedUser.email) {
      updateData.email = this.editForm.email.trim();
    }
    
    if (this.editForm.role && this.editForm.role !== this.selectedUser.role) {
      updateData.role = this.editForm.role;
    }
    
    // MANEJO ESPECIAL PARA isActive - SIEMPRE INCLUIR SI ES DIFERENTE
    if (this.editForm.isActive !== this.selectedUser.isActive) {
      updateData.isActive = Boolean(this.editForm.isActive); // ASEGURAR QUE ES BOOLEAN
    }

    console.log('🔄 Final update data:', updateData);
    console.log('🔄 Update data types:', Object.keys(updateData).map(key => 
      `${key}: ${typeof updateData[key as keyof UpdateUserRequest]} = ${updateData[key as keyof UpdateUserRequest]}`
    ));

    // Si no hay cambios, mostrar mensaje
    if (Object.keys(updateData).length === 0) {
      this.error = 'No changes detected';
      this.loading = false;
      return;
    }

    this.subscription.add(
      this.userService.updateUser(this.selectedUser.id, updateData).subscribe({
        next: (updatedUser) => {
          console.log('✅ User updated successfully:', updatedUser);
          this.closeEditModal();
          this.loading = false;
          // Los usuarios se actualizan automáticamente por el BehaviorSubject
        },
        error: (error) => {
          console.error('❌ Error updating user:', error);
          this.error = error.message || 'Error updating user. Please try again.';
          this.loading = false;
        }
      })
    );
  }

  isEditFormValid(): boolean {
    return !!(
      this.editForm.name?.trim() &&
      this.editForm.email?.trim() &&
      this.editForm.role
    );
  }

  // Delete User Modal Methods
  deleteUser(user: User) {
    this.selectedUser = user;
    this.showDeleteModal = true;
    this.error = null;
    console.log('🗑️ Preparing to delete user:', user);
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.selectedUser = null;
    this.error = null;
  }

  confirmDelete() {
    if (!this.selectedUser) {
      return;
    }

    console.log('🗑️ Confirming deletion of user:', this.selectedUser.id);

    this.loading = true;
    this.error = null;

    this.subscription.add(
      this.userService.deleteUser(this.selectedUser.id).subscribe({
        next: () => {
          console.log('✅ User deleted successfully');
          this.closeDeleteModal();
          this.loading = false;
          // Los usuarios se actualizan automáticamente por el BehaviorSubject
        },
        error: (error) => {
          console.error('❌ Error deleting user:', error);
          this.error = error.message || 'Error deleting user. Please try again.';
          this.loading = false;
        }
      })
    );
  }

  // Toggle User Status
  toggleUser(user: User) {
    const newStatus = !user.isActive;
    console.log('🔄 Toggling user status:', user.id, 'from', user.isActive, 'to', newStatus);
    
    this.subscription.add(
      this.userService.toggleUserStatus(user.id, newStatus).subscribe({
        next: (updatedUser) => {
          console.log('✅ User status updated successfully:', updatedUser);
          // Los usuarios se actualizan automáticamente por el BehaviorSubject
        },
        error: (error) => {
          console.error('❌ Error updating user status:', error);
          this.error = error.message || 'Error updating user status. Please try again.';
        }
      })
    );
  }

  // Método utilitario para obtener avatar
  getUserAvatar(user: User): string {
    return (user.firstName || user.name).charAt(0).toUpperCase();
  }

  // Método para limpiar errores
  clearError() {
    this.error = null;
  }

  // Método para refrescar lista de usuarios
  refreshUsers() {
    this.loadUsers();
  }
}