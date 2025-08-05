import { Component, OnInit, OnDestroy, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subscription, timer } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { of } from 'rxjs';
import { Navbar } from '../../components/navbar/navbar';
import { loginApi, getActiveSpeakerSessionApi, esp32Data } from '../../constants/endPoints';
import { apiURL } from '../../services/api';

interface SpeakerStatus {
  id: number;
  hasActiveSession: boolean;
  color: string;
  locked: boolean;
}

@Component({
  selector: 'app-select-panel',
  imports: [RouterLink, Navbar],
  templateUrl: './select-panel.html',
  styleUrl: './select-panel.css'
})
export class SelectPanel implements OnInit, OnDestroy {
  username: string = 'Username';
  private pressedButton: HTMLElement | null = null;
  private router = inject(Router);
  private http = inject(HttpClient);
  private statusCheckSubscription?: Subscription;

  // ✅ CONFIGURACIÓN DE SPEAKERS
  private readonly API_URL = `${apiURL}${esp32Data}`;
  private readonly CHECK_INTERVAL = 3000; // Verificar cada 3 segundos

  // ✅ MAPEO DE SPEAKERS CON ESTADO
  speakers: SpeakerStatus[] = [
    { id: 1, hasActiveSession: false, color: 'yellow', locked: false },
    { id: 2, hasActiveSession: false, color: 'red', locked: true },
    { id: 3, hasActiveSession: false, color: 'purple', locked: true },
    { id: 4, hasActiveSession: false, color: 'limegreen', locked: true },
    { id: 5, hasActiveSession: false, color: 'blue', locked: true }
  ];

  // ✅ MAPEO DE COLORES A IDs (mantener compatibilidad)
  private readonly speakerMapping = {
    'yellow': 1,
    'red': 2,
    'purple': 3,
    'limegreen': 4,
    'blue': 5
  };

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          this.username = payload.username || payload.name || 'User';
        } catch (e) {
          console.error('Invalid token', e);
        }
      }
    }

    // ⚡ INICIAR VERIFICACIÓN DE ESTADO DE SPEAKERS
    this.startStatusChecking();
  }

  ngOnDestroy(): void {
    this.stopStatusChecking();
  }

  // ⚡ INICIAR VERIFICACIÓN PERIÓDICA DE ESTADO
  private startStatusChecking(): void {
    console.log('🔍 Iniciando verificación de estado de speakers cada 3s');
    
    // Verificar inmediatamente al cargar
    this.checkAllSpeakersStatus();
    
    // Luego verificar cada 3 segundos
    this.statusCheckSubscription = timer(this.CHECK_INTERVAL, this.CHECK_INTERVAL)
      .subscribe(() => {
        this.checkAllSpeakersStatus();
      });
  }

  // ⏹️ DETENER VERIFICACIÓN DE ESTADO
  private stopStatusChecking(): void {
    if (this.statusCheckSubscription) {
      this.statusCheckSubscription.unsubscribe();
      this.statusCheckSubscription = undefined;
      console.log('⏹️ Verificación de estado detenida');
    }
  }

  // 🔍 VERIFICAR ESTADO DE TODOS LOS SPEAKERS
  private checkAllSpeakersStatus(): void {
    // Solo verificar speakers no bloqueados
    const activespeakers = this.speakers.filter(s => !s.locked);
    
    activespeakers.forEach(speaker => {
      this.checkSpeakerStatus(speaker.id);
    });
  }

  // 🔍 VERIFICAR ESTADO DE UN SPEAKER ESPECÍFICO
  private checkSpeakerStatus(speakerId: number): void {
    this.http.get<{ 
      success: boolean; 
      hasActiveSession: boolean; 
      session: any | null;
    }>(`${this.API_URL}${getActiveSpeakerSessionApi}${speakerId}`)
      .pipe(
        catchError(err => {
          console.error(`❌ Error verificando speaker ${speakerId}:`, err);
          return of({ success: false, hasActiveSession: false, session: null });
        })
      )
      .subscribe(response => {
        this.updateSpeakerStatus(speakerId, response.hasActiveSession);
      });
  }

  // 🔄 ACTUALIZAR ESTADO DEL SPEAKER
  private updateSpeakerStatus(speakerId: number, hasActiveSession: boolean): void {
    const speaker = this.speakers.find(s => s.id === speakerId);
    if (speaker && speaker.hasActiveSession !== hasActiveSession) {
      const wasActive = speaker.hasActiveSession;
      speaker.hasActiveSession = hasActiveSession;
      
      console.log(`🔄 Speaker ${speakerId} cambió estado: ${wasActive ? 'activo' : 'inactivo'} → ${hasActiveSession ? 'activo' : 'inactivo'}`);
      
      // Actualizar visualmente el botón
      this.updateButtonVisualState(speakerId, hasActiveSession);
    }
  }

  // 🎨 ACTUALIZAR ESTADO VISUAL DEL BOTÓN
  private updateButtonVisualState(speakerId: number, isActive: boolean): void {
    const button = document.querySelector(`[data-speaker-id="${speakerId}"]`) as HTMLElement;
    if (!button) return;

    const speaker = this.speakers.find(s => s.id === speakerId);
    if (!speaker) return;

    // Remover clases de estado previas
    button.classList.remove('active', 'yellow', 'red', 'purple', 'limegreen', 'blue', 'green');
    
    if (isActive) {
      // Si hay sesión activa, pintar de verde
      button.classList.add('active', 'green');
      button.style.backgroundColor = '#32cd32'; // Verde
    } else {
      // Si no hay sesión activa, volver al color original
      if (speakerId === 1) { // Solo el speaker 1 está disponible
        button.classList.add('active', speaker.color);
        button.style.backgroundColor = this.getColorValue(speaker.color);
      } else {
        // Speakers bloqueados mantienen su estado
        button.style.backgroundColor = '#555';
      }
    }
  }

  // 🎨 OBTENER VALOR DE COLOR
  private getColorValue(color: string): string {
    const colors: { [key: string]: string } = {
      'yellow': '#f9d71c',
      'red': '#e74c3c',
      'purple': '#8e44ad',
      'limegreen': '#32cd32',
      'blue': '#3498db',
      'green': '#32cd32'
    };
    return colors[color] || '#555';
  }

  // ✅ VERIFICAR SI UN SPEAKER TIENE SESIÓN ACTIVA
  public hasSpeakerActiveSession(speakerId: number): boolean {
    const speaker = this.speakers.find(s => s.id === speakerId);
    return speaker?.hasActiveSession || false;
  }

  // ✅ OBTENER COLOR ACTUAL DEL SPEAKER
  public getSpeakerCurrentColor(speakerId: number): string {
    const speaker = this.speakers.find(s => s.id === speakerId);
    if (!speaker) return 'yellow';
    
    // Si tiene sesión activa, verde; si no, su color original
    return speaker.hasActiveSession ? 'green' : speaker.color;
  }

  // ✅ VERIFICAR SI UN SPEAKER ESTÁ BLOQUEADO
  public isSpeakerLocked(speakerId: number): boolean {
    const speaker = this.speakers.find(s => s.id === speakerId);
    return speaker?.locked || false;
  }

  logout(): void {
    localStorage.removeItem('token');
    this.router.navigate([`${loginApi}`]);
  }

  // Método universal para mouse y touch usando PointerEvent
  onButtonDown(event: PointerEvent, color: string): void {
    event.preventDefault();
    event.stopPropagation();
    
    const target = event.target as HTMLElement;
    
    // Solo procesar si no es el botón oculto o bloqueado
    if (target.classList.contains('button-hiden') || target.classList.contains('locked')) {
      return;
    }
    
    this.pressedButton = target;
    
    // Obtener speaker ID del botón
    const speakerId = parseInt(target.getAttribute('data-speaker-id') || '1');
    const currentColor = this.getSpeakerCurrentColor(speakerId);
    
    // Cambiar color y aplicar efecto presionado
    target.style.backgroundColor = this.getColorValue(currentColor);
    target.classList.add('pressed');
    target.classList.add('shiny');
  }

  // ✅ MÉTODO MEJORADO: Navegar según estado actual del speaker
  onButtonUp(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    
    if (this.pressedButton) {
      // Remover efecto presionado
      this.pressedButton.classList.remove('pressed');
      
      // Obtener speaker ID del botón presionado
      const speakerIdStr = this.pressedButton.getAttribute('data-speaker-id');
      const speakerId = speakerIdStr ? parseInt(speakerIdStr) : 1;
      
      
      // Navegar al control panel con el ID específico
      this.router.navigate(['/dashboard/control-panel', speakerId]);
      
      // Remover animación brillante después de un delay
      setTimeout(() => {
        if (this.pressedButton) {
          this.pressedButton.classList.remove('shiny');
        }
      }, 600);
      
      this.pressedButton = null;
    }
  }

  // Método para cuando se sale del botón
  onButtonLeave(event: PointerEvent): void {
    const target = event.target as HTMLElement;
    
    // No procesar el botón oculto o bloqueado
    if (target.classList.contains('button-hiden') || target.classList.contains('locked')) {
      return;
    }
    
    target.classList.remove('pressed');
    target.classList.remove('shiny');
    
    if (this.pressedButton === target) {
      this.pressedButton = null;
    }
  }

  // ✅ MÉTODO PARA NAVEGACIÓN DIRECTA (alternativo)
  navigateToSpeaker(speakerId: number): void {
    this.router.navigate(['/dashboard/control-panel', speakerId]);
  }

  // ✅ MÉTODO PARA FORZAR ACTUALIZACIÓN DE ESTADO
  public refreshSpeakerStatus(): void {
    this.checkAllSpeakersStatus();
  }

  // ✅ MÉTODO PARA DEBUGGING
  public getSpeakersStatus(): SpeakerStatus[] {
    return this.speakers;
  }

  // Método de respaldo para compatibilidad
  changeColor(event: MouseEvent, color: string): void {
    event.preventDefault();
    const target = event.target as HTMLElement;
    
    if (target.classList.contains('button-hiden') || target.classList.contains('locked')) {
      return;
    }
    
    const speakerId = parseInt(target.getAttribute('data-speaker-id') || '1');
    const currentColor = this.getSpeakerCurrentColor(speakerId);
    
    target.style.backgroundColor = this.getColorValue(currentColor);
    target.classList.add('shiny');
    
    setTimeout(() => {
      target.classList.remove('shiny');
    }, 600);
  }
}