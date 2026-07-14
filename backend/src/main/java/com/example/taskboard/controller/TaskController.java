package com.example.taskboard.controller;

import com.example.taskboard.model.Task;
import com.example.taskboard.repository.TaskRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/tasks")
@CrossOrigin(origins = "*")
public class TaskController {

    private final TaskRepository taskRepository;
    private final SimpMessagingTemplate messagingTemplate;

    @Autowired
    public TaskController(TaskRepository taskRepository, SimpMessagingTemplate messagingTemplate) {
        this.taskRepository = taskRepository;
        this.messagingTemplate = messagingTemplate;
    }

    @GetMapping
    public List<Task> getAllTasks() {
        return taskRepository.findAllByOrderByOrderIndexAsc();
    }

    @PostMapping
    public Task createTask(@RequestBody Task task) {
        List<Task> existing = taskRepository.findByStatusOrderByOrderIndexAsc(task.getStatus());
        task.setOrderIndex(existing.size());
        
        Task savedTask = taskRepository.save(task);
        broadcastEvent("CREATE", savedTask);
        return savedTask;
    }

    @PutMapping("/{id}")
    public ResponseEntity<Task> updateTask(@PathVariable Long id, @RequestBody Task taskDetails) {
        Optional<Task> optionalTask = taskRepository.findById(id);
        if (optionalTask.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        Task task = optionalTask.get();
        task.setTitle(taskDetails.getTitle());
        task.setDescription(taskDetails.getDescription());
        task.setStatus(taskDetails.getStatus());
        task.setOrderIndex(taskDetails.getOrderIndex());

        Task updatedTask = taskRepository.save(task);
        broadcastEvent("UPDATE", updatedTask);
        
        return ResponseEntity.ok(updatedTask);
    }

    @PutMapping("/reorder")
    public ResponseEntity<List<Task>> reorderTasks(@RequestBody List<Task> tasks) {
        for (Task t : tasks) {
            Optional<Task> opt = taskRepository.findById(t.getId());
            if (opt.isPresent()) {
                Task existing = opt.get();
                existing.setStatus(t.getStatus());
                existing.setOrderIndex(t.getOrderIndex());
                taskRepository.save(existing);
            }
        }
        List<Task> allTasks = taskRepository.findAllByOrderByOrderIndexAsc();
        messagingTemplate.convertAndSend("/topic/tasks", new TaskEvent("REORDER", allTasks));
        return ResponseEntity.ok(allTasks);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@PathVariable Long id) {
        Optional<Task> optionalTask = taskRepository.findById(id);
        if (optionalTask.isEmpty()) {
            return ResponseEntity.notFound().build();
        }

        taskRepository.deleteById(id);
        broadcastDeleteEvent(id);
        
        return ResponseEntity.noContent().build();
    }

    private void broadcastEvent(String action, Task task) {
        TaskEvent event = new TaskEvent(action, task);
        messagingTemplate.convertAndSend("/topic/tasks", event);
    }

    private void broadcastDeleteEvent(Long taskId) {
        TaskEvent event = new TaskEvent("DELETE", taskId);
        messagingTemplate.convertAndSend("/topic/tasks", event);
    }

    public static class TaskEvent {
        private String action;
        private Task task;
        private Long taskId;
        private List<Task> tasks;

        public TaskEvent() {}

        public TaskEvent(String action, Task task) {
            this.action = action;
            this.task = task;
        }

        public TaskEvent(String action, Long taskId) {
            this.action = action;
            this.taskId = taskId;
        }

        public TaskEvent(String action, List<Task> tasks) {
            this.action = action;
            this.tasks = tasks;
        }

        public String getAction() {
            return action;
        }

        public void setAction(String action) {
            this.action = action;
        }

        public Task getTask() {
            return task;
        }

        public void setTask(Task task) {
            this.task = task;
        }

        public Long getTaskId() {
            return taskId;
        }

        public void setTaskId(Long taskId) {
            this.taskId = taskId;
        }

        public List<Task> getTasks() {
            return tasks;
        }

        public void setTasks(List<Task> tasks) {
            this.tasks = tasks;
        }
    }
}
