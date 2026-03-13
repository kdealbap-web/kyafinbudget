import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { inject } from '@angular/core';

@Component({
  selector: 'app-transaction-type-selector',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule],
  templateUrl: './transaction-type-selector.component.html',
})
export class TransactionTypeSelectorComponent {
  private readonly router = inject(Router);

  goTo(type: 'income' | 'expense'): void {
    void this.router.navigate(['/transactions/new', type]);
  }

  goBack(): void {
    void this.router.navigate(['/transactions']);
  }
}
