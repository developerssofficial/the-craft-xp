/**
 * The Craft — Command Manager (Undo / Redo System)
 * Implements standard Command Pattern with undo/redo stacks and change events.
 */
import { events } from './EventBus.js';

export class CommandManager {
  constructor(maxHistory = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxHistory = maxHistory;
  }

  execute(command) {
    if (!command || typeof command.execute !== 'function') {
      console.error('[CommandManager] Invalid command object:', command);
      return;
    }

    command.execute();
    this.undoStack.push(command);
    this.redoStack = []; // Clear redo stack on new action

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }

    this.notify();
  }

  undo() {
    if (!this.canUndo()) return false;
    const command = this.undoStack.pop();
    command.undo();
    this.redoStack.push(command);
    this.notify();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;
    const command = this.redoStack.pop();
    command.execute();
    this.undoStack.push(command);
    this.notify();
    return true;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this.notify();
  }

  notify() {
    events.emit('history:changed', {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoCount: this.undoStack.length,
      redoCount: this.redoStack.length
    });
  }
}
