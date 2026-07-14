import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { Task, TaskService, TaskEvent } from './services/task.service';
import { Subscription } from 'rxjs';
import { trigger, transition, style, animate } from '@angular/animations';

interface VisualNotification {
  id: number;
  message: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  animations: [
    trigger('cardAnim', [
      transition(':enter', [
        style({ transform: 'translateY(-30px) scale(0.9)', opacity: 0 }),
        animate('350ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
          style({ transform: 'translateY(0) scale(1)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('250ms ease-in', style({ transform: 'scale(0.85) rotate(4deg)', opacity: 0 }))
      ])
    ]),
    trigger('notificationAnim', [
      transition(':enter', [
        style({ transform: 'translateX(120%) rotate(2deg)', opacity: 0 }),
        animate('300ms cubic-bezier(0.175, 0.885, 0.32, 1.275)', 
          style({ transform: 'translateX(0) rotate(-1deg)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ transform: 'translateX(120%)', opacity: 0 }))
      ])
    ])
  ]
})
export class AppComponent implements OnInit, OnDestroy {
  tasks: Task[] = [];
  todoTasks: Task[] = [];
  inProgressTasks: Task[] = [];
  doneTasks: Task[] = [];
  
  notifications: VisualNotification[] = [];
  private notificationIdCounter = 0;
  private wsSubscription: Subscription | null = null;

  // New task form states per column
  showAddForm: { [key: string]: boolean } = {
    'TO_DO': false,
    'IN_PROGRESS': false,
    'DONE': false
  };

  newTask: { [key: string]: Partial<Task> } = {
    'TO_DO': { title: '', description: '' },
    'IN_PROGRESS': { title: '', description: '' },
    'DONE': { title: '', description: '' }
  };

  // Editing states
  editingTaskId: number | null = null;
  editingTaskData: Partial<Task> = {};

  constructor(private taskService: TaskService) {}

  ngOnInit() {
    this.loadTasks();
    this.subscribeToWebSocket();
  }

  ngOnDestroy() {
    if (this.wsSubscription) {
      this.wsSubscription.unsubscribe();
    }
  }

  loadTasks() {
    this.taskService.getTasks().subscribe({
      next: (tasks) => {
        this.tasks = tasks;
        this.distributeTasks();
      },
      error: (err) => console.error('Failed to load tasks', err)
    });
  }

  distributeTasks() {
    this.todoTasks = this.tasks.filter(t => t.status === 'TO_DO').sort((a, b) => a.orderIndex - b.orderIndex);
    this.inProgressTasks = this.tasks.filter(t => t.status === 'IN_PROGRESS').sort((a, b) => a.orderIndex - b.orderIndex);
    this.doneTasks = this.tasks.filter(t => t.status === 'DONE').sort((a, b) => a.orderIndex - b.orderIndex);
  }

  subscribeToWebSocket() {
    this.wsSubscription = this.taskService.getEvents().subscribe((event: TaskEvent) => {
      this.handleWebSocketEvent(event);
    });
  }

  handleWebSocketEvent(event: TaskEvent) {
    console.log('Received websocket event:', event);
    
    if (event.action === 'CREATE' && event.task) {
      const task = event.task;
      // Prevent duplicates if already added locally
      if (!this.tasks.some(t => t.id === task.id)) {
        this.tasks.push(task);
        this.distributeTasks();
        this.pushNotification(`Task added: "${task.title}"`, 'CREATE');
      }
    } else if (event.action === 'UPDATE' && event.task) {
      const updatedTask = event.task;
      const index = this.tasks.findIndex(t => t.id === updatedTask.id);
      if (index !== -1) {
        const oldStatus = this.tasks[index].status;
        this.tasks[index] = updatedTask;
        this.distributeTasks();
        
        let msg = `Task updated: "${updatedTask.title}"`;
        if (oldStatus !== updatedTask.status) {
          msg = `Task moved: "${updatedTask.title}" to ${this.formatStatus(updatedTask.status)}`;
        }
        this.pushNotification(msg, 'UPDATE');
      } else {
        // If not found locally, load all
        this.loadTasks();
      }
    } else if (event.action === 'DELETE' && event.taskId) {
      const id = event.taskId;
      const taskToDelete = this.tasks.find(t => t.id === id);
      if (taskToDelete) {
        this.tasks = this.tasks.filter(t => t.id !== id);
        this.distributeTasks();
        this.pushNotification(`Task deleted: "${taskToDelete.title}"`, 'DELETE');
      }
    } else if (event.action === 'REORDER' && event.tasks) {
      // For reorders, we replace the local order index mapping
      this.tasks = event.tasks;
      this.distributeTasks();
      this.pushNotification('Board layout reordered', 'REORDER');
    }
  }

  pushNotification(message: string, action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER') {
    const id = this.notificationIdCounter++;
    this.notifications.push({ id, message, action });
    setTimeout(() => {
      this.notifications = this.notifications.filter(n => n.id !== id);
    }, 4000);
  }

  formatStatus(status: string): string {
    if (status === 'TO_DO') return 'To Do';
    if (status === 'IN_PROGRESS') return 'In Progress';
    if (status === 'DONE') return 'Completed';
    return status;
  }

  // Task creation
  toggleAddForm(status: string) {
    this.showAddForm[status] = !this.showAddForm[status];
    if (this.showAddForm[status]) {
      this.newTask[status] = { title: '', description: '' };
    }
  }

  submitTask(status: string) {
    const data = this.newTask[status];
    if (!data.title || !data.title.trim()) return;

    const taskToSave: Task = {
      title: data.title.trim(),
      description: (data.description || '').trim(),
      status: status,
      orderIndex: 0 // Will be set by backend to tail
    };

    this.taskService.createTask(taskToSave).subscribe({
      next: (saved) => {
        this.showAddForm[status] = false;
        // The websocket subscription will handle adding it to the UI lists
      },
      error: (err) => console.error('Failed to create task', err)
    });
  }

  // Edit task details
  startEdit(task: Task) {
    if (task.id) {
      this.editingTaskId = task.id;
      this.editingTaskData = { title: task.title, description: task.description };
    }
  }

  saveEdit(task: Task) {
    if (!this.editingTaskData.title || !this.editingTaskData.title.trim()) return;
    
    const updated: Task = {
      ...task,
      title: this.editingTaskData.title.trim(),
      description: (this.editingTaskData.description || '').trim()
    };

    this.taskService.updateTask(updated).subscribe({
      next: () => {
        this.cancelEdit();
      },
      error: (err) => console.error('Failed to update task', err)
    });
  }

  cancelEdit() {
    this.editingTaskId = null;
    this.editingTaskData = {};
  }

  // Delete task
  deleteTask(id: number | undefined) {
    if (!id) return;
    this.taskService.deleteTask(id).subscribe({
      next: () => {
        // The websocket will update the lists
      },
      error: (err) => console.error('Failed to delete task', err)
    });
  }

  // Drag and Drop implementation
  drop(event: CdkDragDrop<Task[]>, targetStatus: string) {
    if (event.previousContainer === event.container) {
      // Reordering within the same list
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      // Moving from one list to another
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex
      );
    }

    // Update statuses and order indices locally
    this.updateLocalIndices(event.container.data, targetStatus);
    
    if (event.previousContainer !== event.container) {
      const sourceStatus = event.previousContainer.id;
      this.updateLocalIndices(event.previousContainer.data, sourceStatus);
    }

    // Collect all tasks to synchronize back to DB
    const updatedTasks = [
      ...this.todoTasks,
      ...this.inProgressTasks,
      ...this.doneTasks
    ];

    // Trigger reorder API call (websocket will broadcast and sync details)
    this.taskService.reorderTasks(updatedTasks).subscribe({
      next: (allTasks) => {
        // Updated successfully
      },
      error: (err) => {
        console.error('Failed to save task order', err);
        this.loadTasks(); // rollback on error
      }
    });
  }

  private updateLocalIndices(list: Task[], status: string) {
    list.forEach((task, index) => {
      task.status = status;
      task.orderIndex = index;
    });
  }

  // Scrapbook visual helpers
  getRotation(id: number | undefined): string {
    if (!id) return 'rotate(0deg)';
    const angles = [-1.8, -1.2, -0.6, 0.6, 1.2, 1.8, 2.2, -2.2];
    const index = id % angles.length;
    return `rotate(${angles[index]}deg)`;
  }

  getNoteColor(id: number | undefined): string {
    if (!id) return 'var(--note-yellow)';
    const colors = [
      'var(--note-yellow)',
      'var(--note-pink)',
      'var(--note-blue)',
      'var(--note-green)'
    ];
    return colors[id % colors.length];
  }
}
