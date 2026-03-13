import { Injectable } from '@angular/core';
import { ProgressBarComponent } from '../components/progress-bar/progress-bar.component';

@Injectable({ providedIn: 'root' })
export class ProgressBarService {
  private bar?: ProgressBarComponent;

  register(bar: ProgressBarComponent): void {
    this.bar = bar;
  }

  start(): void {
    this.bar?.start();
  }

  complete(): void {
    this.bar?.complete();
  }

  error(): void {
    this.bar?.error();
  }
}
