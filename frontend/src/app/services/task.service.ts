import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { Client } from '@stomp/stompjs';
import { environment } from '../../environments/environment';

export interface Task {
  id?: number;
  title: string;
  description: string;
  status: string; // "TO_DO", "IN_PROGRESS", "DONE"
  orderIndex: number;
  createdAt?: string;
}

export interface TaskEvent {
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'REORDER';
  task?: Task;
  taskId?: number;
  tasks?: Task[];
}

@Injectable({
  providedIn: 'root'
})
export class TaskService {
  private apiUrl = `${environment.apiUrl}/api/tasks`;
  private wsUrl = environment.wsUrl;
  
  private stompClient: Client | null = null;
  private eventSubject = new Subject<TaskEvent>();

  constructor(private http: HttpClient) {
    this.initWebSocket();
  }

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  createTask(task: Task): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, task);
  }

  updateTask(task: Task): Observable<Task> {
    return this.http.put<Task>(`${this.apiUrl}/${task.id}`, task);
  }

  reorderTasks(tasks: Task[]): Observable<Task[]> {
    return this.http.put<Task[]>(`${this.apiUrl}/reorder`, tasks);
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private initWebSocket() {
    this.stompClient = new Client({
      brokerURL: this.wsUrl,
      debug: (str) => {
        console.log('STOMP: ' + str);
      },
      reconnectDelay: 5000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000
    });

    this.stompClient.onConnect = (frame) => {
      console.log('Connected to WebSocket');
      this.stompClient?.subscribe('/topic/tasks', (message) => {
        if (message.body) {
          const event: TaskEvent = JSON.parse(message.body);
          this.eventSubject.next(event);
        }
      });
    };

    this.stompClient.onStompError = (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    };

    this.stompClient.activate();
  }

  getEvents(): Observable<TaskEvent> {
    return this.eventSubject.asObservable();
  }
}
