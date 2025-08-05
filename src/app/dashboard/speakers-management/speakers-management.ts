// speakers-management.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SpeakersService } from '../../services/speaker.service';
import { loginApi } from '../../constants/endPoints';

interface Speaker {
  id: number;
  name: string;
  position: string;
  state: boolean;
  batteryPercentage: number;
  createdAt: string;
  updatedAt: string;
  usageSessions: any[];
  _count: {
    usageSessions: number;
    histories: number;
  };
}

interface ApiResponse {
  success: boolean;
  count: number;
  data: Speaker[];
  timestamp: string;
}

interface CreateSpeakerForm {
  name: string;
  position: string;
  state: boolean;
  batteryPercentage: number;
}

interface UpdateSpeakerForm {
  name: string;
  position: string;
  state: boolean;
  batteryPercentage: number;
}

@Component({
  selector: 'app-speakers-management',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule],
  templateUrl: './speakers-management.html',
  styleUrl: './speakers-management.css'
})
export class SpeakersManagementComponent implements OnInit {
  speakers: Speaker[] = [];
  loading = true;
  error = '';

  // Modal control variables
  showCreateModal = false;
  showEditModal = false;
  showDeleteModal = false;
  selectedSpeaker: Speaker | null = null;

  // Form data
  createForm: CreateSpeakerForm = {
    name: '',
    position: '',
    state: false,
    batteryPercentage: 100
  };

  editForm: UpdateSpeakerForm = {
    name: '',
    position: '',
    state: false,
    batteryPercentage: 100
  };

  // Position mapping
  private positionMapping: { [key: string]: string } = {
    'Top Left': 'Top Left',
    'Top Center': 'Top Center', 
    'Top Right': 'Top Right',
    'Center Left': 'Center Left',
    'Center': 'Center',
    'Center Right': 'Center Right',
    'Bottom Left': 'Bottom Left',
    'Bottom Center': 'Bottom Center',
    'Bottom Right': 'Bottom Right'
  };

  // Available positions
  availablePositions = [
    'Top Left',
    'Top Center', 
    'Top Right',
    'Center Left',
    'Center',
    'Center Right',
    'Bottom Left',
    'Bottom Center',
    'Bottom Right'
  ];

  constructor(private speakersService: SpeakersService, private router: Router) {}
  ngOnInit() {
    this.loadSpeakers();
  }

  loadSpeakers() {
    this.loading = true;
    this.error = '';

    this.speakersService.getAllSpeakers().subscribe({
      next: (response: ApiResponse) => {
        if (response.success) {
          this.speakers = response.data;
          console.log('✅ Speakers loaded:', this.speakers);
        } else {
          this.error = 'Error loading speakers';
        }
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading speakers:', error);
        this.error = 'Connection error with server';
        this.loading = false;
      }
    });
  }

  // Get correct position
  getCorrectPosition(position: string): string {
    return this.positionMapping[position] || position;
  }

  // Get speaker color for border
  getSpeakerColor(index: number): { name: string; color: string } {
    const colors = [
      { name: 'Yellow', color: '#ffc107' },
      { name: 'Red', color: '#dc3545' },
      { name: 'Purple', color: '#8b5cf6' },
      { name: 'Green', color: '#32cd32' },
      { name: 'Blue', color: '#007bff' },
      { name: 'Orange', color: '#fd7e14' },
      { name: 'Pink', color: '#e83e8c' },
      { name: 'Cyan', color: '#17a2b8' }
    ];
    return colors[index % colors.length];
  }

  // CREATE SPEAKER MODAL METHODS
  openCreateModal() {
    this.createForm = {
      name: '',
      position: '',
      state: false,
      batteryPercentage: 100
    };
    this.showCreateModal = true;
    this.error = '';
    console.log('📝 Opening create speaker modal');
  }

  closeCreateModal() {
    this.showCreateModal = false;
    this.error = '';
  }

  createSpeaker() {
    if (!this.isCreateFormValid()) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (!this.speakersService.hasAccessToken()) {
      this.error = 'Authentication required. Please log in again.';
      return;
    }

    console.log('📝 Creating speaker with form data:', this.createForm);

    this.loading = true;
    this.error = '';

    const speakerData = {
      name: this.createForm.name.trim(),
      position: this.createForm.position,
      state: Boolean(this.createForm.state),
      batteryPercentage: Number(this.createForm.batteryPercentage)
    };

    this.speakersService.createSpeaker(speakerData).subscribe({
      next: (response) => {
        console.log('✅ Speaker created successfully:', response);
        this.closeCreateModal();
        this.loading = false;
        this.loadSpeakers();
      },
      error: (error) => {
        console.error('❌ Error creating speaker:', error);
        
        if (error.status === 401) {
          this.error = 'Authentication expired. Please log in again.';
        } else if (error.status === 403) {
          this.error = 'You do not have permission to create speakers.';
        } else {
          this.error = error.error?.message || error.message || 'Error creating speaker. Please try again.';
        }
        
        this.loading = false;
      }
    });
  }

  isCreateFormValid(): boolean {
    return !!(
      this.createForm.name?.trim() &&
      this.createForm.position &&
      this.createForm.batteryPercentage >= 0 &&
      this.createForm.batteryPercentage <= 100
    );
  }

  // EDIT SPEAKER MODAL METHODS
  openEditModal(speaker: Speaker) {
    this.selectedSpeaker = { ...speaker };
    this.editForm = {
      name: speaker.name,
      position: speaker.position,
      state: Boolean(speaker.state),
      batteryPercentage: Number(speaker.batteryPercentage)
    };
    this.showEditModal = true;
    this.error = '';
    console.log('📝 Editing speaker:', speaker);
    console.log('📝 Edit form initialized with:', this.editForm);
  }

  closeEditModal() {
    this.showEditModal = false;
    this.selectedSpeaker = null;
    this.error = '';
  }

  updateSpeaker() {
    if (!this.selectedSpeaker || !this.isEditFormValid()) {
      this.error = 'Please fill in all required fields';
      return;
    }

    if (!this.speakersService.hasAccessToken()) {
      this.error = 'Authentication required. Please log in again.';
      return;
    }

    console.log('🔄 Updating speaker with data:', this.editForm);

    this.loading = true;
    this.error = '';

    const updateData: any = {};
    
    // Only include changed fields
    if (this.editForm.name?.trim() && this.editForm.name.trim() !== this.selectedSpeaker.name) {
      updateData.name = this.editForm.name.trim();
    }
    
    if (this.editForm.position && this.editForm.position !== this.selectedSpeaker.position) {
      updateData.position = this.editForm.position;
    }
    
    if (this.editForm.state !== this.selectedSpeaker.state) {
      updateData.state = Boolean(this.editForm.state);
    }
    
    if (Number(this.editForm.batteryPercentage) !== Number(this.selectedSpeaker.batteryPercentage)) {
      updateData.batteryPercentage = Number(this.editForm.batteryPercentage);
    }

    console.log('🔄 Final update data:', updateData);

    // If no changes, show message
    if (Object.keys(updateData).length === 0) {
      this.error = 'No changes detected';
      this.loading = false;
      return;
    }

    this.speakersService.updateSpeaker(this.selectedSpeaker.id, updateData).subscribe({
      next: (response) => {
        console.log('✅ Speaker updated successfully:', response);
        this.closeEditModal();
        this.loading = false;
        this.loadSpeakers();
      },
      error: (error) => {
        console.error('❌ Error updating speaker:', error);
        
        if (error.status === 401) {
          this.error = 'Authentication expired. Please log in again.';
        } else if (error.status === 403) {
          this.error = 'You do not have permission to update speakers.';
        } else {
          this.error = error.error?.message || error.message || 'Error updating speaker. Please try again.';
        }
        
        this.loading = false;
      }
    });
  }

  isEditFormValid(): boolean {
    return !!(
      this.editForm.name?.trim() &&
      this.editForm.position &&
      this.editForm.batteryPercentage >= 0 &&
      this.editForm.batteryPercentage <= 100
    );
  }

  // DELETE SPEAKER MODAL METHODS
  openDeleteModal(speaker: Speaker) {
    this.selectedSpeaker = speaker;
    this.showDeleteModal = true;
    this.error = '';
    console.log('🗑️ Preparing to delete speaker:', speaker);
  }

  closeDeleteModal() {
    this.showDeleteModal = false;
    this.selectedSpeaker = null;
    this.error = '';
  }

  confirmDelete() {
    if (!this.selectedSpeaker) {
      return;
    }

    if (!this.speakersService.hasAccessToken()) {
      this.error = 'Authentication required. Please log in again.';
      return;
    }

    console.log('🗑️ Confirming deletion of speaker:', this.selectedSpeaker.id);

    this.loading = true;
    this.error = '';

    this.speakersService.deleteSpeaker(this.selectedSpeaker.id).subscribe({
      next: (response) => {
        console.log('✅ Speaker deleted successfully:', response);
        this.closeDeleteModal();
        this.loading = false;
        this.loadSpeakers();
      },
      error: (error) => {
        console.error('❌ Error deleting speaker:', error);
        
        if (error.status === 401) {
          this.error = 'Authentication expired. Please log in again.';
        } else if (error.status === 403) {
          this.error = 'You do not have permission to delete speakers.';
        } else if (error.status === 400) {
          this.error = 'Cannot delete speaker with active sessions.';
        } else {
          this.error = error.error?.message || error.message || 'Error deleting speaker. Please try again.';
        }
        
        this.loading = false;
      }
    });
  }

  // UTILITY METHODS
  getBatteryStatus(percentage: number): string {
    if (percentage > 60) return 'high';
    if (percentage > 30) return 'medium';
    if (percentage > 10) return 'low';
    return 'critical';
  }

  getBatteryClass(percentage: number): string {
    const status = this.getBatteryStatus(percentage);
    switch (status) {
      case 'high': return 'battery-high';
      case 'medium': return 'battery-medium';
      case 'low': 
      case 'critical': 
      default: return 'battery-low';
    }
  }

  formatLastConnection(date: string): string {
    const connectionDate = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - connectionDate.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    } else if (diffHours > 0) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    } else {
      return 'A few minutes ago';
    }
  }

  // Toggle speaker state
  toggleSpeaker(speaker: Speaker) {
    const newState = !speaker.state;
    
    this.speakersService.updateSpeaker(speaker.id, { state: newState }).subscribe({
      next: (response) => {
        // Update speaker in local list
        const index = this.speakers.findIndex(s => s.id === speaker.id);
        if (index !== -1) {
          this.speakers[index].state = newState;
        }
        console.log('✅ Speaker state updated successfully');
      },
      error: (error) => {
        console.error('❌ Error updating speaker state:', error);
        this.error = 'Error updating speaker status';
      }
    });
  }

  // Logout method
  logout() {
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

  // Get total sessions for a speaker
  getTotalSessions(speaker: Speaker): number {
    return speaker._count?.usageSessions || 0;
  }

  // Get total histories for a speaker
  getTotalHistories(speaker: Speaker): number {
    return speaker._count?.histories || 0;
  }

  // Check if speaker has active session
  hasActiveSession(speaker: Speaker): boolean {
    return speaker.usageSessions && speaker.usageSessions.length > 0;
  }

  // Get active session info
  getActiveSessionInfo(speaker: Speaker): any {
    if (this.hasActiveSession(speaker)) {
      return speaker.usageSessions[0];
    }
    return null;
  }

  // Clear error method
  clearError() {
    this.error = '';
  }
}