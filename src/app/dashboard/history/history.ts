import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { Navbar } from '../../components/navbar/navbar';
import { SpeakersService } from '../../services/speaker.service';
import { HistoryItem } from '../../interfaces/speakerInterface';
import { CalendarDay, DisplayHistoryItem } from '../../interfaces/historyInterface';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CommonModule, RouterModule, Navbar, HttpClientModule],
  templateUrl: './history.html',
  styleUrls: ['./history.css'],
  providers: [SpeakersService]
})
export class History implements OnInit {
  expandedIndex: number | null = null;
  username: string = 'John Doe';
  showLogoutButton: boolean = true;
  historyItems: DisplayHistoryItem[] = [];
  filteredHistoryItems: DisplayHistoryItem[] = [];
  loading = true;
  error: string | null = null;
  speakerIdFilter: number | null = null;

  // Calendar properties
  showCalendar = false;
  selectedDate: Date | null = null;
  currentCalendarDate = new Date();
  calendarDays: CalendarDay[] = [];
  dateFilter: string | null = null;

  // Calendar navigation
  monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  constructor(
    private router: Router,
    private speakersService: SpeakersService
  ) {}

  ngOnInit(): void {
    this.loadHistory();
    this.generateCalendar();
    
    // Listen for escape key to close calendar
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && this.showCalendar) {
        this.showCalendar = false;
      }
    });
  }

  // 🔥 MÉTODO OPTIMIZADO: Cargar historial básico
  loadHistory(): void {
    this.loading = true;
    this.error = null;
    
    if (this.speakerIdFilter) {
      this.loadSpeakerHistory(this.speakerIdFilter);
    } else {
      this.speakersService.getAllSpeakersHistory().subscribe({
        next: (histories: HistoryItem[]) => {
          this.historyItems = this.transformHistoryData(histories);
          this.applyFilters();
          this.updateCalendarWithHistory();
          this.loading = false;
        },
        error: (error) => {
          console.error('❌ Error loading history:', error);
          this.error = 'Error al cargar el historial. Por favor, intenta de nuevo.';
          this.loading = false;
        }
      });
    }
  }

  // 🔥 MÉTODO OPTIMIZADO: Cargar historial de parlante específico
  loadSpeakerHistory(speakerId: number): void {
    this.loading = true;
    this.error = null;

    this.speakersService.getSpeakerHistory(speakerId, 50, 1).subscribe({
      next: (response) => {
        this.historyItems = this.transformHistoryData(response.data.histories);
        this.applyFilters();
        this.updateCalendarWithHistory();
        this.loading = false;
      },
      error: (error) => {
        console.error('❌ Error loading speaker history:', error);
        this.error = `Error al cargar el historial del parlante ID: ${speakerId}`;
        this.loading = false;
      }
    });
  }

  // 🔥 MÉTODO OPTIMIZADO: Transformar datos SIN LOGS EXCESIVOS
  private transformHistoryData(histories: HistoryItem[]): DisplayHistoryItem[] {
    return histories.map(history => {
      const displayItem: DisplayHistoryItem = {
        id: history.id,
        usageSessionId: history.usageSessionId,
        speakerId: history.speakerId,
        speakerName: history.speakerName,
        speakerPosition: history.speakerPosition,
        userId: history.userId,
        username: history.user?.username || 'Usuario desconocido',
        startDate: this.formatTimestamp(history.startDate),
        endDate: this.formatTimestamp(history.endDate),
        durationMinutes: history.durationMinutes,
        
        // 🔥 DATOS BÁSICOS - Los detalles se cargan solo cuando se expande
        avgCurrent_mA: history.avgCurrent_mA,
        avgVoltage_V: history.avgVoltage_V,
        avgPower_mW: history.avgPower_mW,
        
        totalCurrent_mA: history.totalCurrent_mA,
        totalVoltage_V: history.totalVoltage_V,
        totalPower_mW: history.totalPower_mW,
        totalConsumed_mAh: history.totalConsumed_mAh,
        
        // Información de batería
        initialBatteryPercentage: history.initialBatteryPercentage,
        finalBatteryPercentage: history.finalBatteryPercentage,
        batteryConsumed: history.batteryConsumed,
        
        createdAt: this.formatTimestamp(history.createdAt),
        
        // Raw dates para filtrado
        rawStartDate: new Date(history.startDate),
        rawEndDate: new Date(history.endDate),
        rawCreatedAt: new Date(history.createdAt)
      };

      return displayItem;
    });
  }

  private formatTimestamp(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  // 🔥 APLICAR FILTROS SIN LOGS
  private applyFilters(): void {
    let filtered = [...this.historyItems];

    // Apply speaker ID filter
    if (this.speakerIdFilter) {
      filtered = filtered.filter(item => item.speakerId === this.speakerIdFilter);
    }

    // Apply date filter
    if (this.selectedDate) {
      const selectedDateStr = this.formatDateForComparison(this.selectedDate);
      filtered = filtered.filter(item => {
        const itemDateStr = this.formatDateForComparison(item.rawStartDate);
        return itemDateStr === selectedDateStr;
      });
    }

    this.filteredHistoryItems = filtered;
    this.expandedIndex = null;
  }

  // 🔥 FORMATEAR FECHA PARA COMPARACIÓN (YYYY-MM-DD)
  private formatDateForComparison(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  // 🔥 MANEJAR INPUT DEL FILTRO SIN LOGS
  onFilterInput(event: any): void {
    const value = event.target.value;
    
    if (!value || value === '' || Number(value) <= 0) {
      this.speakerIdFilter = null;
    } else {
      this.speakerIdFilter = Number(value);
    }
    
    this.applyFilters();
  }

  // 🔥 GENERAR CALENDARIO
  generateCalendar(): void {
    const year = this.currentCalendarDate.getFullYear();
    const month = this.currentCalendarDate.getMonth();
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());
    
    this.calendarDays = [];
    const today = new Date();
    
    for (let i = 0; i < 42; i++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + i);
      
      const isCurrentMonth = currentDate.getMonth() === month;
      const isToday = this.isSameDate(currentDate, today);
      const isSelected = this.selectedDate ? this.isSameDate(currentDate, this.selectedDate) : false;
      
      this.calendarDays.push({
        date: new Date(currentDate),
        day: currentDate.getDate(),
        isCurrentMonth,
        isToday,
        isSelected,
        hasHistory: false,
        historyCount: 0
      });
    }
    
    this.updateCalendarWithHistory();
  }

  // 🔥 ACTUALIZAR CALENDARIO CON HISTORIAL
  updateCalendarWithHistory(): void {
    this.calendarDays.forEach(day => {
      const dayDateStr = this.formatDateForComparison(day.date);
      const historyCount = this.historyItems.filter(item => {
        const itemDateStr = this.formatDateForComparison(item.rawStartDate);
        return itemDateStr === dayDateStr;
      }).length;
      
      day.hasHistory = historyCount > 0;
      day.historyCount = historyCount;
    });
  }

  // 🔥 VERIFICAR SI DOS FECHAS SON EL MISMO DÍA
  private isSameDate(date1: Date, date2: Date): boolean {
    return this.formatDateForComparison(date1) === this.formatDateForComparison(date2);
  }

  // 🔥 SELECCIONAR FECHA EN EL CALENDARIO
  selectDate(day: CalendarDay): void {
    if (!day.isCurrentMonth) return;
    
    if (this.selectedDate && this.isSameDate(day.date, this.selectedDate)) {
      this.selectedDate = null;
      this.dateFilter = null;
    } else {
      this.selectedDate = new Date(day.date);
      this.dateFilter = this.formatDateForDisplay(this.selectedDate);
    }
    
    this.generateCalendar();
    this.applyFilters();
  }

  // 🔥 FORMATEAR FECHA PARA MOSTRAR
  private formatDateForDisplay(date: Date): string {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  // NAVEGACIÓN DE CALENDARIO
  previousMonth(): void {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() - 1);
    this.currentCalendarDate = new Date(this.currentCalendarDate);
    this.generateCalendar();
  }

  nextMonth(): void {
    this.currentCalendarDate.setMonth(this.currentCalendarDate.getMonth() + 1);
    this.currentCalendarDate = new Date(this.currentCalendarDate);
    this.generateCalendar();
  }

  // TOGGLE CALENDAR
  toggleCalendar(): void {
    this.showCalendar = !this.showCalendar;
  }

  // LIMPIAR FILTRO DE FECHA
  clearDateFilter(): void {
    this.selectedDate = null;
    this.dateFilter = null;
    this.generateCalendar();
    this.applyFilters();
  }

  // 🔥 LIMPIAR TODOS LOS FILTROS
  clearAllFilters(): void {
    this.speakerIdFilter = null;
    this.selectedDate = null;
    this.dateFilter = null;
    this.generateCalendar();
    this.applyFilters();
  }

  // 🔥 TOGGLE ITEM - AQUÍ ES DONDE CARGAMOS LOS DETALLES
  toggleItem(index: number): void {
    if (this.expandedIndex === index) {
      // Si ya está expandido, lo contraemos
      this.expandedIndex = null;
    } else {
      // Si no está expandido, lo expandimos
      this.expandedIndex = index;
      // Los detalles ya están cargados en el objeto, no necesitamos hacer nada más
      // Los valores ya están transformados en transformHistoryData()
    }
  }

  // REFRESCAR HISTORIAL
  refreshHistory(): void {
    this.loadHistory();
  }

  loadMore(): void {
    // TODO: Implementar paginación
  }

  // GETTERS
  get currentMonthYear(): string {
    return `${this.monthNames[this.currentCalendarDate.getMonth()]} ${this.currentCalendarDate.getFullYear()}`;
  }

  get hasActiveFilters(): boolean {
    return this.speakerIdFilter !== null || this.selectedDate !== null;
  }

  // 🔥 MÉTODO DE DEBUGGING SIMPLIFICADO - SOLO CUANDO SE NECESITE
  debugHistoryData(): void {
    if (this.historyItems.length === 0) {
      console.log('🔍 No hay datos de historial para debuggear');
      return;
    }

    console.log('🔍 === DEBUG SIMPLE ===');
    console.log('Total items:', this.historyItems.length);
    console.log('Items filtrados:', this.filteredHistoryItems.length);
    console.log('Filtros activos:', {
      speakerId: this.speakerIdFilter,
      fecha: this.selectedDate?.toDateString()
    });
    
    // Solo mostrar el primer item como ejemplo
    const firstItem = this.historyItems[0];
    console.log('Primer item:', {
      id: firstItem.id,
      speaker: firstItem.speakerName,
      usuario: firstItem.username,
      duracion: firstItem.durationMinutes,
      bateria: `${firstItem.initialBatteryPercentage}% -> ${firstItem.finalBatteryPercentage}%`
    });
    console.log('==================');
  }
}